# 网络与代理

南农的部分系统（尤其是数智教务平台 `szjw.njau.edu.cn`）对校内和校外返回不同的解析结果：

| 域名 | 校园 DNS 解析 | 公共 DNS 解析 |
|---|---|---|
| szjw.njau.edu.cn | 202.195.242.146 | 112.4.128.139 |

在校园网内用公共 DNS 解析出的地址访问 szjw 时，TLS 能握手成功，但 HTTP 请求一直没有响应。走境外代理同样不通。

## 症状

- `njau-cli network check` 里 `szjw` 显示 `TimeoutError`，其他站点正常；
- 解析出的地址是 `198.18.x.x`，说明代理软件开着 fake-ip / TUN 模式。

## Clash / mihomo 配置

在全局扩展脚本（Clash Verge Rev：订阅 → 全局扩展脚本）里加入：

```js
function main(config) {
  config.rules = ["DOMAIN-SUFFIX,njau.edu.cn,DIRECT"].concat(config.rules || []);
  config.dns = config.dns || {};
  config.dns["fake-ip-filter"] = (config.dns["fake-ip-filter"] || []).concat(["+.njau.edu.cn"]);
  config.dns["nameserver-policy"] = Object.assign({}, config.dns["nameserver-policy"] || {}, {
    "+.njau.edu.cn": ["202.195.241.234", "system"]
  });
  return config;
}
```

保存后在 Clash 里重新激活一次当前订阅，然后运行 `njau-cli network check` 确认。

## 校外

校外访问 szjw 一般需要学校 VPN；`njau-cli` 不会尝试绕过任何访问控制。
