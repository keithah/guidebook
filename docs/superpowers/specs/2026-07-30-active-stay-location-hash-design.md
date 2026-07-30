# Active stay-location hash transition

## Problem

When the app already has browser-derived coordinates and a guest opens a valid stay link in the same running tab, the hash changes but the existing coordinates remain active. A guest who was previously located in Montana therefore continues to see Montana even when the new stay payload contains the approved `1620 Howard St, San Francisco` override.

## Behavior

- A valid `fakeLocation` remains inactive until the guest has allowed location in the current app session.
- If location is already allowed and a hash change introduces a valid `fakeLocation`, the app immediately replaces the current coordinates with that override.
- Activating the override must not call browser geolocation, reload the page, or reset unrelated application state.
- The override remains associated with the hash that activated it. Removing or replacing that hash clears stale override-owned coordinates using the existing transition behavior.
- Hashes without a valid override preserve existing browser or cottage coordinates.

## Implementation boundary

Keep the change inside `AppContext`'s stay/hash-to-location state synchronization. Do not remount the provider, force navigation, change the guest-link payload, or alter map/routing consumers; they already consume the active `coords` value correctly.

## Verification

Add a context regression that starts with browser coordinates representing Montana, grants location, changes to the Howard stay hash, and proves:

- active coordinates become the normalized Howard override;
- the location remains marked as allowed; and
- browser geolocation is not called again.

Retain coverage for initial override consent, override removal/replacement, cottage coordinates, invalid overrides, and ordinary browser geolocation. Run the focused context tests followed by the full test, lint, and production-build gates.
