# Changelog

## v2.1.2

### Added

- **Nuvio integration** - New Nuvio tab in Titlebar Navigation. Sign in to your Nuvio account for two-way sync of add-ons, plugins, collections, settings, watch history, and library. The Nuvio button can be hidden from the title bar under `Settings → Navigation`.
- **UI scaling** - Application UI scale can be adjusted under `Settings → UI → Application UI Scale`. Recommended for users running Windows display scaling or very high-resolution displays. Consider adjusting EPG visible hours alongside this setting.
- **Configurable EPG grid hours** - The number of hours displayed in the EPG grid can be customized under `Settings → Live TV → EPG → EPG Visible Hours`.
- **Channel loading overlay** - A loading overlay is now displayed while a Live TV channel is buffering. Enable under `Settings → Playback → Reconnect`.
- **Move to Top in Manage Categories** - Press `↑↑` on a category in Manage Categories to move it to the top of the list instantly, or use the new `Select to Move to Top` button to multi-select and move multiple categories at once.
- **Shortcut keys for Stremio and Nuvio** - Keyboard shortcuts for Stremio and Nuvio can be configured under `Settings → Shortcuts` (defaults: Stremio `X`, Nuvio `N`).
- **Custom recording end padding** - The end padding applied to recordings can now be set to a custom duration, replacing the previous fixed maximum of 15 minutes. Useful for events that tend to run over their scheduled end time.
- **Expanded settings menu** - A button in the top-right corner of the Settings page allows the settings menu to be expanded to full screen.
- **Poster Scaling for Strem/Nuvio** - Scale poster sizes using the slider scale in top left of navigation bar.
- **Cache Stremio fetch results** - Cache fetch results from addons with set timer. Enable in `Strem → Settings`
- **Hide EPG buttons** - Individual EPG toolbar buttons (`Manage Channels`, `Refresh Source`, `EPG Shift`, `Playlist Editor`, `Failover Group`) can be hidden under `Settings → Navigation → EPG`.
- **Default Language & Subtitles Off** - Added new options for Default Subtitle: Off, and Language:Default. Default language will select the default audio track.
- **Discord button** - Added a Discord button in `Settings → About` to join the ynoTV discord.

### Fixed

- **Late-starting sport matches not auto-refreshing** - Resolved an issue where matches that kicked off after their scheduled start time would fail to refresh automatically every 30 seconds.
- **Default subtitle not being selected** - Fixed an issue where default subtitle language wasn't being correctly selected when subtitle addons were enabled in Strem.

## v2.1.1

### Added

- **Playlist Editor** - A full-featured playlist editor, access by pressing the Playlist Editor button in EPG. Has the following capabilities:
  - Create a new custom playlist using categories and channels from any existing source by either the + button in the Categories sidebar, or using the Playlist Editor button.
  - Merge categories from different sources into one another.
  - Add individual channels from any source into any category.
  - Create custom categories within any source and populate them with channels of your choice.
- **Export to M3U** - Export M3U/XC/Custom playlist, including all modifications done such as disabled channels/categories, custom sort order, and edited EPG data, can be exported to an `.m3u` file. Access via the Playlist Editor and select `Export`.
- **Convert recordings to MKV/MP4** - Live TV recordings can be converted to MKV or MP4 format manually, or automatically upon completion. Auto-conversion can be configured in Settings.
- **Stremio account sync** - Sign in to your Stremio account directly in the app to sync your Watchlist, Watch Progress, and Add-ons. Two-way sync is supported. 
- **Streaming network catalogs** - OTT catalogs for VOD and Stremio are now available, including Top 10 and genre-based collections. Requires a free TMDB API key configured under `Settings → Metadata`.
- **Cast detail pages** - Cast members listed on Movies and Series detail pages are now clickable, opening a page displaying their other works. Available in both VOD and Stremio. Requires a free TMDB API key configured under `Settings → Metadata`.
- **Global EPG channel count** - The Global EPG tab now displays both the number of programs added and the number of channels populated for each source it's linked to.
- **Refreshed default Stremio badges** - The default badge styling for Stremio links has been updated with a new look.
- **Reload button in the media bar** - The current stream can be reloaded directly from the media bar without leaving stream.
- **Automatic download posters** - Cover art is now automatically added to entries in the Downloads section.
- **VOD favourites** - Movies and Series in VOD can now be added to your favourites.
- **Top navigation for Sports, DVR, and Calendar** - Sports, DVR, and Calendar have been moved from the sidebar to a top navigation bar for a cleaner layout.
- **Bold font toggle for Live TV** - The font weight used for Categories and Channels in Live TV can be switched to bold under `Settings → Live TV → EPG`.
- **Show/Hide Cast and Calendar buttons** - The Cast and Calendar buttons in the Title bar can be toggled under `Settings → Navigation`.
- **Playback transition background** - When starting playback of a Movie or Series, a transition screen featuring the title and background art is now displayed.
- **What's New Modal** - Added a What's New popup modal on fresh launch of a new version to display changes that were made, can also check changelogs in `Settings → About`

### Fixed

- **Managed Categories not persisting after cache clear** - Custom category configurations will now be retained when the cache is cleared.
- **Import/Export not functioning correctly** - Resolved an issue affecting playlist import and export operations.
- **Closed captions not appearing in Live TV** - Closed caption support for Live TV channels has been restored.
- **New categories appearing out of sort order** - Newly created categories will now be inserted in the correct position according to the active sort order from source.
- **Stremio search results not applying metadata on detail pages** - Additional metadata will now load correctly when viewing results from Stremio search results.
- **Recent Results in WC2026** - Fixed recent results only showing first 5 results, and not most recent
- **Fix Custom Catgory sort ortder** - Fixed user set custom category sort order -v2.1.1


## v2.0.3

### Added

- **Transparent EPG overlay** - A transparent EPG overlay can be toggled via hotkey (default: `Z`). Height, opacity, and display behaviour on channel zap are configurable under `Settings → Live TV → EPG`.
- **VOD & Strem downloads** - Movies and series can now be downloaded directly from their detail page using the new download button. Active and completed downloads are accessible in the DVR section. The default download location can be changed under `DVR → Settings`.
- **Play while recording** - Recordings currently in progress can now be played back simultaneously. Ideal for users with a single connection limit who want to record and watch the same channel at the same time.
- **M3U catch-up support for custom playlists** - Users with a custom M3U playlist created from an XC source that supports catchup can now enable catch-up playback via `Settings → Source → Edit Source → Xtream Catchup`. Filling in the Xtream Catchup field will also retrieve connection count and expiration details from the XC provider, which are then displayed on the source card.
- **SOCKS5 proxy support** - A SOCKS5 proxy can be configured to route all application traffic through it.
- **Hideable top categories** - The `All Channels`, `Favorites`, `Watchlist`, and `Recently Viewed` categories can now be hidden from the sidebar by right-clicking and selecting `Hide Category`. They can be re-enabled under `Settings → Navigation → Category`.

### Fixed

- **Font size customisation not applied at small resolutions** - Custom font size settings were not being respected on lower-resolution displays. This has been resolved.

## v2.0.2

### Added

- **Metadata badges in search** - Metadata badges are now displayed in search results and populates when a channel is played from results
- **User agent forwarded during EPG fetch** - The source user agent is now passed when retrieving EPG data, ensuring compatibility with providers that require a user agent for EPG requests.
- **Trakt catalogs in Discover** - Catalogs imported from Trakt are now accessible from the Discover page.
- **Popout/External mode persistence** - The selected playback mode (Popout or External) will now be retained across restarts.
- **Settings search bar** - A search bar has been added to the Settings page for quickly locating individual settings.
- **Sync error notification** - If a source fails to sync, a red notification will appear in the bottom-right corner displaying the associated error message.
- **Multiview Stalker support** - Stalker sources can now be used in multiview.

### Fixed

- **Casting reliability for Live TV channels** - Casting to TV from Live TV has been improved for a more consistent experience.
- **VOD custom sort order not being applied** - VOD libraries were incorrectly displaying in alphabetical order regardless of any custom sort order configured by the user.
- **Stalker EPG incomplete program data** - EPG data for Stalker sources now utilises both `get_epg_info` and `get_short_epg` endpoints, ensuring full program guide coverage.

## v2.0.1

### Added

- **Dedicated World Cup tab** - A World Cup tab has been added to the Sports page, including support for live and upcoming match listings.
- **Trakt catalog import** - Your Trakt catalogs can now be imported directly into Strem. Manage catalogs under `Settings → Trakt`. The `Resume Watching` catalog can be used to sync watch progress from Trakt.
- **Xtream Code autofill** - Pasting an Xtream Code M3U link into the source field will now automatically populate the relevant credentials.
- **Nuvio/Fusion badge support** - Custom Badge Filters used for Nuvio/Fusion can now be used in Strem links display. Add Badge configs in `Settings → Strem`
- **Search history** - Live TV and Strem search queries are now saved upon pressing Enter, allowing previous searches to be quickly recalled.
- **Strem add-on link filter** - Add-on links in Strem can now be filtered by addon for easier navigation.

### Fixed

- **LiveTV Metadata badges not appearing on slow streams** - Badges will now display correctly regardless of stream load time.
- **Cinemeta Series Discover page not loading** - Resolved an issue preventing the Cinemeta Series Discover page from displaying correctly.
- **EPG preview resizing at high display scaling** - The EPG preview will no longer resize unexpectedly when display scaling is set to a high amount.
- **Error overlay persisting after stream recovery** - The error overlay will now dismiss correctly once a stream successfully starts following an error.

## v2.0.0

### Added

- **Stremio add-ons support** - A dedicated `Strem.` page has been added for Stremio add-on support. Navigate to the Strem page and click `Manage Add-ons` to add your Stremio add-ons. Strem Tab can be hidden in new `Settings -> Navigations` if you don't plan to use it.
- **HLS multiview** - Multiview now has an option to choose between MPV or HLS container for playback. Use HLS if your system can't handle multi MPV or if you need overlays
- **Cast to TV** - Casting to any Chromecast-compatible device is now supported. Enable under `Settings → Playback → Google Cast`. A Windows firewall prompt will appear on first use to allow local network scanning for available devices.
- **External player support** - Any channel can be sent to an external player of your choice. Configure the player under `Settings → Playback → External/Popout Player`. Access via `Right-click → Send to External Player`, or click the screen icon in the EPG and set it to `External` to route all playback externally.
- **IntroDB integration** - A skip intro button will appear for Series episodes with an entry in IntroDB. Auto-skip can be enabled, and the button display duration is configurable under `Settings → Playback → Skip Intro`.
- **Trakt integration** - Trakt scrobbling is now supported for VOD and Stremio streams. Trakt watchlists can also be imported directly into Strem catalogs.
- **Hide navigation tabs** - Individual tabs can be hidden from the title bar navigation by unchecking them under `Settings → Navigation`. Hide any unnecessary tabs you don't use. 
- **Clear Recent List** - The recent channels list can now be cleared by right-clicking `Recent` in the sidebar and selecting `Clear`.
- **Startup View** - Configure which page is displayed on launch under `Settings → Startup → Startup View`.
- **Live TV sync only** - A new option in Source settings allows syncing Live TV channels exclusively, skipping VOD content entirely. Enable via the checkbox in `Settings → Source Settings`.
- **Rugby support** - Rugby has been added to the Sports page. Enable under `Sports → Settings`.
- **Aspect ratio selector** - A new button on the Now Playing Bar allows the aspect ratio to be changed during playback.
- **Movies & Series detail page overhaul** - The Movies detail page now includes cast headshots. The Series page has been reworked to display episode summaries and screen captures.
- **Improved TMDB metadata matching** - VOD movie metadata matching against TMDB has been refined for greater accuracy.
- **EPG programme overlap prevention** - EPG entries from providers that supply overlapping programme blocks will now be split automatically. When a second programme begins, the preceding block is closed at that point.
- **Borderless popout player** - The title bar has been removed from the popout window for a cleaner display.
- **Default audio and subtitle language** - Preferred audio and subtitle languages can be set under `Settings → Subtitles & Audio`. Applies to VOD and Stremio streams.
- **Disable event-based reconnect** - Event based detection for autoreconnect is disabled by default now as it was too aggressive, causing unstable streams to constantly reconnect.  Can re-enable if it didn't cause issues under `Settings → Playback → Reconnect`.
- **Default user agent** - The default user agent is now set to `ynoTVPlayer` rather than being left blank.

### Fixed

- **SubSource applying incorrect season for Series** - Subtitle lookups via SubSource will now resolve to the correct season.
- **Update popup not scaling correctly** - The update popup now renders properly for users with display scaling applied.
- **Stalker adult channels not appearing** - Resolved an issue preventing adult channels from Stalker sources from being displayed.
- **Quick Record not starting immediately** - Upon clicking the button, recording should start immediately now.

## v1.7.1

### Added

- **Overlay widgets** — Customisable widgets can now be added to the playback screen for additional information and navigation. Right-click the background or stream to add widgets. Size and background opacity are configurable under `Settings → Widgets`.
  - **Live Sports Score widget** — Displays live scores for ongoing matches at the top of the overlay. Click a score to view detailed match information, or right-click to hide specific matches. Available in two modes: `Persistent` (remains visible when the UI overlay auto-hides) and `Autohide` (hides alongside the UI overlay).
  - **Recent Channels widget** — Shows recently watched channels along with their currently airing programme. Click any entry to switch to that channel.
  - **Custom Group widget** — Displays channels and their currently airing programmes from a selected custom group, enabling quick channel switching directly from the overlay.
  - **What's Next widget** — Shows the next scheduled programme on the current channel.
- **Category search** — A search bar has been added to the top of the Category sidebar for faster category navigation.
- **Autohide overlay timer** — The duration of inactivity before the overlay auto-hides is now configurable under `Settings → UI → Autohide Overlay Timer`.

### Fixed

- **Sport match cards not displaying correctly** — Match cards for Racing, Golf, Tennis, and MMA now display correct layout.
- **M3U links with no categories not displaying in sidebar** — Channels from M3U sources with no assigned categories are now correctly shown in the sidebar.


## v1.7.0

### Added

- **Global EPG** — A global EPG source can now be configured to apply across any playlist, automatically filling in missing EPG data without requiring per-source setup. Configurable under `Settings → Source → EPG`.
- **Popout player** — Streams can now be played in a dedicated popout MPV window. Access via `Right-click → Play in Popout`. The window can be set to always stay on top under `Settings → Popout Player`.
- **Popout mode for Live TV EPG** — Activating Popout mode via the new icon on the middle-right of the Live TV EPG will route all channel selections directly to the popout player.

### Fixed

- **Manage Categories saving slowly** — Resolved a performance issue causing category changes to take longer than expected to save.
- **Fullscreen button clipped in Alternate EPG view** — The fullscreen button is now fully visible and accessible in the Alternate EPG layout.
- **Auto-updater popup not rendering Markdown** — The update changelog popup now correctly renders Markdown formatting.


## v1.6.9

### Added

- **Backup DNS per source** — A backup DNS option is now available in Source settings. If the primary source URL becomes unreachable or fails during a sync, the app will automatically fall back to user-configured backup URLs. Backup URLs can be validated at any time using the `Test` button.
- **Failover group overlay** — A new overlay is displayed in the main view when the active channel belongs to a Failover group. The overlay shows all channels in the group alongside the currently playing channel, and allows switching to any group member with a single click.
- **Picture-in-Picture resizing** — The PiP window can now be resized by dragging from its bottom-left corner.
- **Category context menu** — Right-clicking a category in the sidebar now presents the following options: `Rename Category`, `Manage Categories`, and `Hide Category`.
- **Rename channel** — Channels can now be renamed directly via the right-click context menu.
- **Settings menu declutter** — The settings menu has been reorganised for a cleaner, less cluttered layout.
- **Provider channel sort order** — A new `Provider` sort option has been added to the channel list, preserving the order in which channels appear in the source M3U or provider feed. Recommended for use with EPGenius. Configurable under `Settings → Live TV → Sort`.

### Fixed

- **M3U playlists with uncategorised channels not appearing in Live TV** — Channels in M3U playlists that have no assigned category will now be grouped under an `Uncategorized` category and displayed correctly in Live TV.
- **Duplicate channels omitted from playlist** — Resolved an issue where channels sharing the same TVG-ID and playback URL were causing entries to be silently dropped from the playlist.

## v1.6.8

### Added

- **Stream Failover** *(Beta)* — Automatically detects when a channel stalls or drops and seamlessly switches to an alternate channel from a user-defined failover group. Channels can be added to a group via the new `Stream Failover Group` button in Live TV, or through `Right-click → Add to Failover Group`.
- **Automatic stream retry** — Detects stream failures and automatically attempts to reconnect. The maximum number of reconnection attempts can be configured under `Settings → Playback`.
- **EPG shift shortcut** — A quick-access EPG Shift button has been added to the top of the EPG view for faster time offset adjustments.

### Fixed

- **Additional EPG failing for large uncompressed `.gz` files** — Resolved an issue preventing large uncompressed `.gz` EPG files from loading correctly.
- **VOD Manage Categories resetting unsaved changes** — The category list will no longer refresh and discard unsaved changes while managing VOD categories.
- **Double-click to exit Live TV triggering too broadly** — Exiting Live TV to fullscreen via double-click now requires both clicks to occur within 500ms, preventing unintended dismissals.

## v1.6.7

### Added

- **Advanced search** — Access via the search icon at the end of the search bar. Supports filtering by Channels only, EPG only, or specific sources and categories.
- **Multiple EPG support per source** — Additional EPG sources can be added via `Source Settings → Add Additional EPG`. Supplemental EPGs will only populate data absent from the primary EPG.
- **SubSource subtitle integration** — Configure your SubSource API key under `Settings → Subtitles`. The app will automatically search for subtitles by title when the subtitles button is activated during Movies or Series playback.
- **Enhanced subtitle menu** — New controls for Delay, Size, Offset, Background, and Opacity.
- **Additional dark themes** — New variants featuring true black backgrounds in place of grey, available in multiple accent colors.
- **Channel search in EPG Editor** — Enables matching for EPGs that do not rely on TVG-IDs, using a workflow similar to the existing Advanced EPG Matching feature.
- **Resizable EPG sidebar and channel column** — Drag to adjust the width of the Category sidebar and Channel column in the EPG view. Right-click either element to restore default dimensions.
- **Channel info overlay** — Enable under `Settings → Live View`. Relocates channel information from the Now Playing bar to the top-left corner of the screen. Text, logo, box, and background opacity are each individually adjustable.
- **Refreshed sports match cards** — Updated visual design for match cards in the Sports section.
- **Bulk EPG auto-matching** — A new `Automatch Missing` tab in the EPG Editor allows all unmatched channels within a source or category to be matched in a single operation.
- **Adjustable EPG preview text size** — Configurable under `Settings → Live TV`.
- **Sync debug logging** — Detailed logging output is now available to assist with diagnosing synchronisation issues.
- **Hide channel option** — Channels can now be hidden via the right-click context menu.
- **Alphabetical category sorting** — Categories can now be sorted A–Z under `Settings → Channels → Category Display`.

### Fixed

- **Catch-up timezone resolution** — Catch-up channels now correctly retrieve the timezone from the provider, ensuring accurate playback of recorded programmes.
- **Disabled category channels appearing in search** — Channels belonging to disabled categories will no longer appear in search results.
- **Modern UI failing to load on fresh install** — The Modern UI now initialises correctly on a clean installation. Users who prefer the previous appearance may revert via `Settings → Live TV`.

## v1.6.6

### Added

- Bundled ytdlp for better YouTube playback for playlists with youtube links
- Highlight current channel being played in Search Results
- Highlight last clicked stream on Game Card for Sports when using "Show Search Results"
- Setting -> Playback, added Check Loaded MPV Parameters button at the bottom to check if parameters are correctly loaded
- Setting -> Playback added a disable parameter whitelist

### Fixed

- Concurrent sync for multiple sources not updating EPG due to db lock
- Fixed MPV parameters not passing properly to MPV

## v1.6.5

### Added

- Mediabar button on EPG Preview autohides unless mouse is over video
- Added stop button in EPG Preview
- Mediabar buttons added for Sports page Preview
- Double clicking preview on Sports page will full screen video in app
- When leaving Movies/series page and clicking back into Movies/Series again, it will go back to the movies/series page you were on
- Added option to not save resolution on exit in Settings -> UI
- When no TMDB key is provided, uses TVMaze as backup metadata for Series
- Added sizing slider for posters for Movies/Series, removed dead space between posters
- Added a hide category button in LiveTV, to expand category again there will be a button in the middle left to expand. Alternatively you can use the category shortcut instead.
- Added a Refresh Source button in the EPG, so you can refresh the Channels/EPG without having to go back in Settings. Does the same as the sync button.

### Fixed

- Channel number will properly update upon resyncs
- Fixed an error in VOD page display that would incorrectly show zero results for search/category
- Fixed some UI elements
- Parallel api calls for Live Now page for sports instead of sequential for faster loading
- Fixed a bug when in Maximize view from Titlebar, going full screen would not cover Taskbar
- Fixed a bug when using settings and closing, it would reset to the video view
- When clicking a category in Movies/Series and there is text in the Search, it will clear the search before loading into the category
- Fixed text scrolling in Modern UI
- Fixed scrollbar styling to match theme.

## v1.6.4

### Added

- Collapse source categories on startup option in Settings -> LiveTV
- Modern UI Design if you want a different look for LiveTV, enable in Settings -> LiveTV
- Log Retention settings in Settings -> Debug. Choose number of days of logs you want saved, rest will be deleted.
- Option to show search results in Alphabetical order, in Settings -> Channels -> Search Results order
- Option to choose how many sources sync during autosync/Sync button in Settings -> Data Refresh

### Fixed

- Fixed error overlay popping up on local streams
- Fixed sync button in Settings doing sequential syncing instead of parallel
- Padding fixes for UI
- Backend fixes

## v1.6.3

### Fixed

- EPG saving in diff timezone
- EPG Time Shift not working properly, should be reflected instantly now upon saving
- EPG Editor changes should be reflected immediately now
- https epg's not working properly
- Movies not loading when container_extension is null

## v1.6.2

### Added

- EPG Editor, right click any channel and you can delete/edit/add programs, change tvgid, match to a different EPG with search. Can also match EPG from different source
- Source syncing moved to Rust for M3U/Xtream for speed improvement.
- Vod recent watch tab.
- Vod Recent watch carousel on home page
- Saved progress for VOD, will save progress on pressing Stop, switching to LiveTV ch, or gets autoupdated every 30 seconds.
- For Series, the Up and Down button on the bottom media bar will now go to Previous/Next episode
- Clicking a recent watched Series will correctly bring it to the current season being watched

### Fixed

- Dark Theme scrollbar now uses accent color to be more visible.
- Clicking favorites on a channel doesn't bring channel list back to top
- Restricting certain MPV args
- VOD categories loading should be faster, removed lazy loading
- Disabled Source's VOD won't Show
- Backend changes that should make Startup faster
- Documentation updated

## v1.6.1

### Added

- Max Search Limit setting(Settings -> Channels)
- Option to right click a channel and copy stream url if you want to play in external player for M3U and Xtream sources
- Copy Stream URL for Vods of Xtream Code sources
- Draggable Preview resize for EPG and Sports preview video. Bottom Right of preview stream in EPG/LiveTV view is draggable, bottom for Alternate View. Right click the drag part to reset back to default.
- Alternate EPG view, Default shortcut E to swap views, or in Settings -> LiveTV -> EPG View Layout
- Hide Sports Categories button added in top right of Sidebar.
- Better search query for multi words
- New Search Team option in Sports for Live Games, clicking the new Search Teams button on a Match Card will do a search for both team names in your playlist for better matching
- Show Search Results option on Sports Live Now Match cards, clicking it will display all channels with the game inside the card, clicking a channel will play the stream so you can easily swap between Live Games inside Sports View.
- Up/Down channel button in Preview and Now Playing bar
- Channel list will smoothly scroll when using Up/Down shortcut or button
- List Vod Movies/series by sources
- Manage Vod categories, Right click the source in Movies/Series and you can enable/disable categories
- Better debug logging when debug is enabled

### Fixed

- Removed TMDB automatic matching, was causing slowdowns. It will instead display Trending Now, Top Rated, On the Air, and Popular categories in Home view of Movies/Series. Clicking on one of the movies/series will do a search within your playlist for that specific title.
- Removed Genre carousel for Vods as it was causing slowdown in loading the Movies/Series page.
- Vod optimization, categories should show instantly now
- Fixed Stalker/MAC portal VOD so it doesn't display error message for working streams
- Now Playing bar not appearing when text is in search field

## v1.6.0

### Added

- Current watching channel is now highlighted in LiveTV/EPG
- Added new option in Settings -> LiveTV. Enable pause/volume control in the Preview video for EPG. Restart is needed for it to take effect.
- Double clicking preview video now full screens video in app.
- Double clicking anywhere on non UI elements now full screens the app, and the reverse to disable full screen
- Added shortcut key to replay last stream

### Fixed

- Scroll is reset on changing categories.
- Fixed stream starting in paused state when opening after another stream that ended

## v1.5.9

### Added

- EPG matching for some external EPG providers, when adding sources or editing, check Advanced EPG Matching to enable
- Autosync will check in background if EPG is stale to the time set in Data Refresh

### Fixed

- Certain stalker portals weren't saving channels properly
- Clear cache vacuums SQLite database
- db-wal truncates after sync
- Backend changes
- Calendar Add to Watchlist

## v1.5.8

### Added

- Current time indicator in EPG
- When searching in Custom Group Manager and Calendar Change Channel, Source name will be shown as the Main group to differentiate channels from different sources.
- Added 3 new options in settings.
  - Settings -> Channels -> Include source name in search. Enabling this will also show the Source of channel in search results, and show Source in Multiview mini media bars.
  - Settings -> Cache -> Live Now Buffer Offset. Set a buffer offset if when clicking Go Live during Cache Time Shift is causing buffer stall.
  - Settings -> LiveTV -> Make EPG current airing program blocks darker. Enabling this will deepen/darker programs that are live if you are having trouble seeing the highlighted program in certain themes.

### Fixed

- Fixed a bug where Height and Width would increase on every launch
- Fixed EPG preview panel not updating on certain actions.
- Removed some excessive logging while not in debug mode.

## v1.5.7

### Added

- Catchup for providers that provide Catchup Channels
- Cache Time Shift: Uses MPV's --demuxer-max-back-bytes flag to Cache stream while watching, so you can rewind and have instant access/replay that's being cached while watching.
- While watching a live channel that has Catchup and you have cache time shift enabled, you will be able to switch between the two in the Now Playing bar.
- How to enable Cache Time Shift: In Settings -> Cache, Enable Time Shift and select Cache size and restart.
- Auto-Update

### Fixed

- Resizing/Moving while Multiview is selected. It is best to resize/move the app to where you want it before watching for best experience.
