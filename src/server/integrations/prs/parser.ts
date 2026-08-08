/** Pure remote-URL parsing lives in shared/ so the web client can also derive a
 * "view on GitHub/GitLab" link without duplicating the SSH/HTTPS regexes — this
 * module just re-exports it under the path the rest of integrations/prs already
 * imports from. */
export { parseRemoteUrl, detectRemotePlatform, remoteWebUrl, type ParsedRemote } from "../../../shared/remoteUrl.js";
