#!/usr/bin/env python3
"""Disposable native MediaWiki/SQLite HTTP acceptance. Requires PHP and a core checkout.

Usage: python3 scripts/test-page-owned-http.py /path/to/mediawiki
Creates no data in the configured wiki. Credentials and SQLite data are temporary.
"""
import copy
import http.cookiejar
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request


def require_loopback_url(url, allowed_host):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "http" or parsed.netloc != allowed_host:
        raise RuntimeError("Request or redirect escaped disposable loopback server")


class LoopbackRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_host):
        super().__init__()
        self.allowed_host = allowed_host

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        resolved = urllib.parse.urljoin(req.full_url, newurl)
        require_loopback_url(resolved, self.allowed_host)
        return super().redirect_request(req, fp, code, msg, headers, resolved)


def parse_bootstrap_config(html, key="wgLayersEditorInit"):
    marker = json.dumps(key) + ":"
    count = html.count(marker)
    if count == 0:
        return None
    if count != 1:
        raise ValueError("Ambiguous bootstrap data")
    value = html.split(marker, 1)[1].lstrip()
    try:
        obj, end = json.JSONDecoder().raw_decode(value)
    except json.JSONDecodeError:
        raise ValueError("Malformed bootstrap JSON data") from None
    if not isinstance(obj, dict) or not value[end:].lstrip().startswith((",", "}")):
        raise ValueError("Malformed bootstrap object boundary")
    return obj


def main():
    core = Path(sys.argv[1]).resolve()
    extension = Path(__file__).resolve().parent.parent
    with tempfile.TemporaryDirectory(prefix="layers-http-") as temporary:
        root = Path(temporary)
        password = secrets.token_urlsafe(32)
        password_file = root / "password"
        password_file.write_text(password)
        password_file.chmod(0o600)
        with socket.socket() as socket_probe:
            socket_probe.bind(("127.0.0.1", 0))
            port = socket_probe.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        loopback_host = f"127.0.0.1:{port}"
        installed = subprocess.run([
            "php", str(core / "maintenance/run.php"), "install",
            "--dbtype", "sqlite", "--dbpath", str(root), "--dbname", "acceptance",
            "--confpath", str(root), "--server", base, "--scriptpath", "",
            "--passfile", str(password_file), "Layers HTTP acceptance", "LayersAcceptance"
        ], cwd=core, env=dict(os.environ, MW_CONFIG_FILE=str(root / "LocalSettings.php")),
           capture_output=True, text=True, timeout=90)
        if installed.returncode:
            raise RuntimeError("Disposable MediaWiki installation failed: " + (installed.stderr + installed.stdout).replace(password, "[redacted]"))
        config = root / "LocalSettings.php"
        # JSON strings are also safe PHP double-quoted strings for these paths.
        manifest = json.dumps(str(extension / "extension.json")).replace("$", "\\$")
        with config.open("a") as settings:
            settings.write("\nwfLoadExtension( 'Layers', " + manifest + " );\n")
            settings.write("$wgLayersPageOwnedPilotEnabled = true;\n")
            settings.write("$wgLayersPageOwnedPilotOwners = [ 'Layers_HTTP_acceptance' ];\n")
        environment = dict(os.environ, MW_CONFIG_FILE=str(config))
        # Loading the extension after core installation does not install its tables.
        # Exercise the real updater so this fixture also supports ordinary slides.
        updated = subprocess.run([
            "php", str(core / "maintenance/run.php"), "update", "--quick"
        ], cwd=core, env=environment, capture_output=True, text=True, timeout=90)
        if updated.returncode:
            raise RuntimeError("Disposable extension schema update failed: " +
                               (updated.stderr + updated.stdout).replace(password, "[redacted]"))
        with (root / "server.log").open("w") as log:
            server = subprocess.Popen(["php", "-S", f"127.0.0.1:{port}", "-t", str(core)],
                                      cwd=core, env=environment, stdout=log, stderr=log)
            try:
                cookies = http.cookiejar.CookieJar()
                auth_client = urllib.request.build_opener(
                    urllib.request.HTTPCookieProcessor(cookies),
                    LoopbackRedirectHandler(loopback_host)
                )
                anon_client = urllib.request.build_opener(
                    LoopbackRedirectHandler(loopback_host)
                )

                def request(params, post=False):
                    encoded = urllib.parse.urlencode(dict(params, format="json", formatversion=2)).encode()
                    url = base + "/api.php"
                    response = auth_client.open(url if post else url + "?" + encoded.decode(),
                                                data=encoded if post else None, timeout=20)
                    return json.load(response), response.headers

                def get_html(client_to_use, path_and_query):
                    url = urllib.parse.urljoin(base + "/", path_and_query.lstrip("/"))
                    require_loopback_url(url, loopback_host)
                    response = client_to_use.open(url, timeout=20)
                    require_loopback_url(response.geturl(), loopback_host)
                    body = response.read().decode("utf-8", "replace")
                    return response.status, response.headers, body

                def verify_cache_headers(headers, scenario_label):
                    cc = headers.get("Cache-Control", "")
                    for directive in ("no-store", "no-cache", "max-age=0", "must-revalidate"):
                        assert directive in cc, f"{scenario_label}: Cache-Control missing '{directive}': {cc}"
                    expires = headers.get("Expires", "")
                    assert expires == "Thu, 01 Jan 1970 00:00:00 GMT", f"{scenario_label}: Unexpected Expires header: {expires}"

                def verify_robot_policy(html, scenario_label):
                    match = re.search(r'<meta[^>]*name=["\']robots["\'][^>]*content=["\']([^"\']+)["\']', html, re.IGNORECASE)
                    if not match:
                        match = re.search(r'<meta[^>]*content=["\']([^"\']+)["\']\s+name=["\']robots["\']', html, re.IGNORECASE)
                    assert match is not None, f"{scenario_label}: Missing meta robots tag in HTML"
                    content = match.group(1).lower()
                    assert "noindex" in content and "nofollow" in content, f"{scenario_label}: Robots policy does not contain noindex,nofollow: {content}"

                def verify_denial(status, headers, html, scenario_label):
                    assert status == 200, f"{scenario_label}: Expected status 200, got {status}"
                    verify_cache_headers(headers, scenario_label)
                    verify_robot_policy(html, scenario_label)
                    assert 'id="layers-editor-container"' not in html, f"{scenario_label}: Unexpected editor container present in denial"
                    assert "ext.layers.editor" not in html, f"{scenario_label}: Unexpected ext.layers.editor module present in denial"
                    assert parse_bootstrap_config(html) is None, f"{scenario_label}: Unexpected bootstrap config present in denial"
                    assert "The page-owned Layers editor is unavailable" in html, f"{scenario_label}: Missing localized unavailable message"

                for attempt in range(50):
                    try:
                        token = request(dict(action="query", meta="tokens", type="login"))[0]
                        break
                    except OSError:
                        if server.poll() is not None or attempt == 49:
                            raise RuntimeError("Disposable HTTP server did not start")
                        time.sleep(0.1)
                login = request(dict(action="login", lgname="LayersAcceptance", lgpassword=password,
                                     lgtoken=token["query"]["tokens"]["logintoken"]), True)[0]
                assert login["login"]["result"] == "Success", "Authentication failed"
                csrf = request(dict(action="query", meta="tokens"))[0]["query"]["tokens"]["csrftoken"]
                userinfo = request(dict(action="query", meta="userinfo"))[0]["query"]["userinfo"]
                actor_id = str(userinfo["id"])
                assert int(actor_id) > 0, "Failed to resolve authenticated actor ID"
                snapshot = json.loads((extension / "tests/fixtures/revisions/slide-document-v1.json").read_text())
                owner = "Layers HTTP acceptance"

                def publish(data, revision, summary):
                    return request(dict(action="layerspublish", owner=owner, baserevid=revision,
                                        data=json.dumps(data), summary=summary, token=csrf,
                                        maintext="Disposable page-owned history acceptance"), True)[0]

                first = publish(snapshot, 0, "First Layers revision")
                assert "layerspublish" in first, "Initial publication failed: " + str(first.get("error", {}).get("code"))
                first_id = first["layerspublish"]["revid"]

                # Step 1: Registered editor route GET after first publication
                status1, headers1, html1 = get_html(
                    auth_client,
                    f"/index.php?title=Special:EditLayersPage&owner=Layers_HTTP_acceptance&revid={first_id}&surface=presentation"
                )
                assert status1 == 200, "Editor GET for first revision failed status"
                verify_cache_headers(headers1, "Editor GET (rev 1)")
                verify_robot_policy(html1, "Editor GET (rev 1)")
                assert 'id="layers-editor-container"' in html1, "Editor container missing in editor GET (rev 1)"
                assert "ext.layers.editor" in html1, "ext.layers.editor module missing in editor GET (rev 1)"
                cfg1 = parse_bootstrap_config(html1)
                assert cfg1 is not None, "Bootstrap config missing in editor GET (rev 1)"
                assert cfg1.get("pageOwned", {}).get("owner") == "Layers_HTTP_acceptance"
                assert cfg1.get("pageOwned", {}).get("revisionId") == first_id
                assert cfg1.get("pageOwned", {}).get("surfaceId") == "presentation"
                assert cfg1.get("pageOwned", {}).get("readOnly") is False
                assert cfg1.get("pageOwned", {}).get("draftScope", {}).get("user") == actor_id
                assert cfg1.get("filename") == "Layers HTTP acceptance"
                assert cfg1.get("isSlide") is True
                assert cfg1.get("autoCreate") is False
                assert cfg1.get("imageUrl") is None

                # Second publication
                changed = copy.deepcopy(snapshot)
                changed["surfaces"][0]["label"] = "Second saved version"
                second = publish(changed, first_id, "Second Layers revision")
                assert "layerspublish" in second, "Second publication failed"
                second_id = second["layerspublish"]["revid"]
                assert second_id != first_id

                # Step 2 & 3: Capture history and snapshots before editor GET group
                def get_history():
                    return request(dict(action="query", prop="revisions", titles=owner, rvlimit=10,
                                        rvprop="ids|user|comment"))[0]["query"]["pages"][0]["revisions"]

                def read_snapshot(revid):
                    return request(dict(action="layersread", owner=owner, revid=revid, maxage=600, smaxage=600))

                history_before = get_history()
                rev1_snapshot_before, rev1_headers = read_snapshot(first_id)
                rev2_snapshot_before, _ = read_snapshot(second_id)
                assert rev1_snapshot_before["layersread"]["revisionId"] == first_id
                assert rev1_snapshot_before["layersread"]["snapshot"] == snapshot
                assert rev2_snapshot_before["layersread"]["revisionId"] == second_id
                assert rev2_snapshot_before["layersread"]["snapshot"] == changed
                assert "private" in rev1_headers["Cache-Control"] and "max-age=0" in rev1_headers["Cache-Control"]

                # Step 2: Editor GET scenarios after second publication
                # 2a. Stale revision (first_id is now stale after second publication)
                s_stale, h_stale, html_stale = get_html(
                    auth_client,
                    f"/index.php?title=Special:EditLayersPage&owner=Layers_HTTP_acceptance&revid={first_id}&surface=presentation"
                )
                verify_denial(s_stale, h_stale, html_stale, "Stale revision editor GET")

                # 2b. Current revision (second_id succeeds with exact configuration)
                s_cur, h_cur, html_cur = get_html(
                    auth_client,
                    f"/index.php?title=Special:EditLayersPage&owner=Layers_HTTP_acceptance&revid={second_id}&surface=presentation"
                )
                assert s_cur == 200, "Current revision editor GET failed status"
                verify_cache_headers(h_cur, "Current revision editor GET")
                verify_robot_policy(html_cur, "Current revision editor GET")
                assert 'id="layers-editor-container"' in html_cur, "Editor container missing in current revision editor GET"
                assert "ext.layers.editor" in html_cur, "ext.layers.editor module missing in current revision editor GET"
                cfg2 = parse_bootstrap_config(html_cur)
                assert cfg2 is not None, "Bootstrap config missing in current revision editor GET"
                assert cfg2.get("pageOwned", {}).get("owner") == "Layers_HTTP_acceptance"
                assert cfg2.get("pageOwned", {}).get("revisionId") == second_id
                assert cfg2.get("pageOwned", {}).get("surfaceId") == "presentation"
                assert cfg2.get("pageOwned", {}).get("readOnly") is False
                assert cfg2.get("pageOwned", {}).get("draftScope", {}).get("user") == actor_id

                # 2c. Malformed revision
                s_mal, h_mal, html_mal = get_html(
                    auth_client,
                    "/index.php?title=Special:EditLayersPage&owner=Layers_HTTP_acceptance&revid=bad_rev&surface=presentation"
                )
                verify_denial(s_mal, h_mal, html_mal, "Malformed revision editor GET")

                # 2d. Missing surface
                s_nosurf, h_nosurf, html_nosurf = get_html(
                    auth_client,
                    f"/index.php?title=Special:EditLayersPage&owner=Layers_HTTP_acceptance&revid={second_id}"
                )
                verify_denial(s_nosurf, h_nosurf, html_nosurf, "Missing surface editor GET")

                # 2e. Out-of-scope owner
                s_badown, h_badown, html_badown = get_html(
                    auth_client,
                    f"/index.php?title=Special:EditLayersPage&owner=Unconfigured_Owner&revid={second_id}&surface=presentation"
                )
                verify_denial(s_badown, h_badown, html_badown, "Out-of-scope owner editor GET")

                # 2f. Anonymous editor request (cookie-free client)
                s_anon, h_anon, html_anon = get_html(
                    anon_client,
                    f"/index.php?title=Special:EditLayersPage&owner=Layers_HTTP_acceptance&revid={second_id}&surface=presentation"
                )
                verify_denial(s_anon, h_anon, html_anon, "Anonymous editor GET")

                # Read-only historical route must keep the requested old revision, also for anonymous readers.
                for viewer_client in (auth_client, anon_client):
                    view_status, view_headers, view_html = get_html(viewer_client,
                        f"/index.php?title=Special:ViewLayersPage&owner=Layers_HTTP_acceptance&revid={first_id}&surface=presentation")
                    assert view_status == 200, "Historical viewer HTTP request failed"
                    verify_cache_headers(view_headers, "Historical viewer")
                    verify_robot_policy(view_html, "Historical viewer")
                    view_cfg = parse_bootstrap_config(view_html, "wgLayersRevisionView")
                    assert view_cfg == {"owner": "Layers_HTTP_acceptance", "revisionId": first_id,
                                        "surface": snapshot["surfaces"][0]}, "Historical viewer changed the requested snapshot"
                    assert 'id="layers-history-container"' in view_html
                    assert "ext.layers.history" in view_html
                    assert "wgLayersEditorInit" not in view_html and "ext.layers.editor" not in view_html

                # Step 3: Verify history and snapshots remain unchanged after the editor GET group
                history_after = get_history()
                assert [r["revid"] for r in history_after] == [r["revid"] for r in history_before], "History revids mutated by editor GETs"
                assert [r["comment"] for r in history_after] == [r["comment"] for r in history_before], "History comments mutated by editor GETs"
                assert [r["user"] for r in history_after] == [r["user"] for r in history_before], "History users mutated by editor GETs"

                rev1_snapshot_after, _ = read_snapshot(first_id)
                assert rev1_snapshot_after["layersread"]["revisionId"] == first_id
                assert rev1_snapshot_after["layersread"]["snapshot"] == snapshot
                assert rev1_snapshot_after == rev1_snapshot_before, "Rev 1 snapshot mutated by editor GETs"

                rev2_snapshot_after, _ = read_snapshot(second_id)
                assert rev2_snapshot_after["layersread"]["revisionId"] == second_id
                assert rev2_snapshot_after["layersread"]["snapshot"] == changed
                assert rev2_snapshot_after == rev2_snapshot_before, "Rev 2 snapshot mutated by editor GETs"

                # Preserved checks: stale save conflict rejection
                conflict = publish(snapshot, first_id, "Stale save must fail")
                assert conflict["error"]["code"] == "layers-edit-conflict"

                class HistoryLinks(HTMLParser):
                    def __init__(self):
                        super().__init__()
                        self.links = []

                    def handle_starttag(self, tag, attrs):
                        values = dict(attrs)
                        if tag == "a" and "layers-history-view-link" in values.get("class", "").split():
                            self.links.append(values["href"])

                hist_status, _, hist_html = get_html(auth_client,
                    "/index.php?title=Layers_HTTP_acceptance&action=history")
                assert hist_status == 200, "Native history request failed"
                history_links = HistoryLinks()
                history_links.feed(hist_html)
                targets = [urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
                           for url in history_links.links]
                assert sorted(int(item["revid"][0]) for item in targets) == sorted([first_id, second_id]), "History links did not retain exact revisions"
                assert all(item["owner"] == ["Layers_HTTP_acceptance"] and
                           item["surface"] == ["presentation"] for item in targets), "History links changed owner/surface"

                # Refetch after the failed write; the pre-save response cannot prove this.
                history_after = get_history()
                assert read_snapshot(first_id)[0] == rev1_snapshot_before
                assert read_snapshot(second_id)[0] == rev2_snapshot_before
                # Final two-revision history verification
                assert [r["revid"] for r in history_after] == [second_id, first_id]
                assert [r["comment"] for r in history_after] == ["Second Layers revision", "First Layers revision"]
                assert all(r["user"] == "LayersAcceptance" for r in history_after)

                print("PASS: authenticated HTTP publication, two page-history revisions, actor/summary, "
                      "exact historical snapshot, private caching, stale-save rejection, registered editor "
                      "route GET bootstrap, stale-revision denial, parameter rejections, anonymous denial, "
                      "cache-control/robot headers, authenticated/anonymous exact historical viewer responses, "
                      "native exact-revision history links, and history/snapshot invariance; disposable wiki cleaned up.")
            finally:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()


if __name__ == "__main__":
    main()
