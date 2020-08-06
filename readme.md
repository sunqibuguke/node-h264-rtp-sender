# H264 RTP Sender


node.js H264 RTP 分包工具，从性能上说 node 并不适合做这个工作，但是可以作测试工具只用。

分包类型：

- 单个 NAL 包
- FU-A 分片

### TODO

- 增加 STAP-A 聚合封包，适用于发送SPS PPS 