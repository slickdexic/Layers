# Layers engineering rules

Layers is a MediaWiki extension. Docker is only the project's development/test environment.

- Do not design or implement Docker workers, container orchestration, host supervisors, PowerShell or .NET as Layers runtime architecture, dependencies or optional feature backends.
- Implement features through supported MediaWiki extension mechanisms. Existing MediaWiki/PHP/database and format-specific media-handler requirements apply.
- The earlier RenderJob/FramedSession/RenderLaunchProtocol supervisor direction is abandoned. J35 and container dispatch/recovery follow-ups are cancelled. Retained prototype artifacts and test counts are historical evidence, not approved architecture or future assignments.
- Do not gate page revision history, search, Cargo integration, image annotations, PDF annotations or general-purpose slides on completion of container work.
- Docker commands are permitted to operate the existing test environment and run tests. Do not confuse that environment with the extension's supported deployment architecture.
- Preserve unrelated work. Consult docs/IMPLEMENTATION_HANDOFF_PLAN.md for the current MediaWiki-native implementation queue.
- Read the charter section "Read this first" before any task. Never remove, replace or move anything users have (tools, buttons, overlays, viewers, entry points, wording) without the project owner's prior approval of a behaviour brief. Silence in the charter is not permission. Say "layer" and "layer set", never "drawing" for them ("drawing tools" is fine); decide wording by meaning, never by search and replace. Tell the owner the same day about any stop-gap.
- docs/PROJECT_CHARTER.md defines the finish line (Layers 2.0). Name the charter criterion each piece of work advances; work that advances none waits until the project owner changes the charter.
