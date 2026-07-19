# debug-playlist-hidden

Status: OPEN

## Symptom
- 登录后“我的音乐 / 歌单”现在看不到歌单。

## Hypotheses
- H1: `/user/getUserPlaylists` 改为 POST 后当前 QQ API 或代理没有正确接收 body，导致接口返回空或错误。
- H2: 接口返回了歌单，但前端 `unwrap` 或字段路径解析未覆盖当前响应结构，导致 `playlist` 数组为空。
- H3: `qqPlaylistType` 标记或 `createdPlaylistCount/subPlaylistCount` 计算错误，导致 `libraryStore.updateUserPlaylist` 把列表切成空。
- H4: `changeList()` 在异步加载后被状态变量覆盖，导致 `libraryList` 被置成空。
- H5: 登录态 cookie 没有透传到用户歌单接口，接口退化返回空列表。

## Instrumentation Plan
- 在用户歌单 API 层记录请求方法、响应关键路径长度、归一化后长度。
- 在 `LibraryType.vue` 记录加载到的列表长度、创建/收藏计数、当前筛选状态。
- 在 `libraryStore.updateUserPlaylist/changeLibraryList` 记录切分前后长度。

## Evidence
- `trae-debug-log-playlist-hidden.ndjson` 多次记录 `user-api-error`：`Request failed with status code 405`，`data: Method Not Allowed`。
- 随后 `library-type-loaded` 记录 `total: 0`，`library-store-update-user-playlist` 记录 `total: 0`。
- H1 confirmed: `/user/getUserPlaylists` 改为 POST 后当前 QQ API 不接受该方法。
- H2/H3/H4/H5 rejected for current symptom: 未进入有效响应解析和切分阶段，根因发生在请求方法层。
- Post-fix 日志记录 `user-api-response-shape`：`dataDataKeys: ["playlists"]`，`directPlaylistLength: 2`。
- Post-fix 日志记录 `sampleRawKeys` 包含 `dissid` 和 `dirid`，但这两个用户创建歌单也带 `dirid`。
- H3 confirmed for secondary symptom: 直接用 `dirid` 判断收藏歌单导致创建歌单全部误分到“我收藏的”。
- Post-fix user feedback: “我喜欢”入口可见，但详情为空。需要继续验证 `getUserLikedSongs` 的接口状态和响应路径。

## Fix
- 将 `getUserPlaylist` 请求方法从 POST 改回 GET，但继续只通过 `X-Custom-Cookie` header 传递 cookie，避免 URL 超长。
- 对 `data.playlists` 直接返回路径统一标记为 `created`；只有分离的 `mymusic/collect*` 路径标记为 `collect`。
- 将 QQ “我喜欢”接为虚拟歌单，详情页走 `getUserLikedSongs`。

## Verification
- Pending
