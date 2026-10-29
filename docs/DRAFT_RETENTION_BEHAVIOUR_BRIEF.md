# Draft retention after successful Save

**Owner approved October 28, 2026; implementation and acceptance in progress.**
Advances DATA-1, DATA-3 and HIST-4.

Repeated successful Saves should not fill browser storage with superseded
recovery copies from the same editor session. Once the server confirms a Save
and the current editor has safely written its new-base recovery copy, the
editor may remove its own older copy for that confirmed Save. The current copy
continues to protect edits made while the Save was in progress.

Keep recovery sources, other tabs' copies, and copies whose publication outcome
is uncertain or conflicted. If the new copy cannot be written, keep the old
copy and the existing warning; never pretend a failed backup succeeded. Save,
Close, recovery choices and their existing wording and controls remain.

Verify repeated Saves under a bounded storage quota, edits made during Save,
lost responses, failed writes, recovery, and concurrent editor tabs. Show the
implemented behavior to the owner before considering this change complete.

## Large-image quota correction

When an ordinary write exceeds browser storage quota, the local candidate can
store a lossless representation that holds repeated large strings once. Reading
reconstructs the exact original draft, including Undo history; existing normal
drafts remain readable. Nothing is removed to make room. If the compact copy
still cannot fit, the existing refusal and preservation behavior remains.

Older editor code does not understand the compact representation. Before
rolling back an installation, recover or save any such drafts with the updated
editor; do not delete them. Testing and owner acceptance remain in progress.
