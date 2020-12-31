/**
 * @param {string} remoteUrl
 * @param {import("../typedefs").Credentials} credentials
 * @returns {string}
 */
export default (remoteUrl, credentials = {}) => {
  let remote = "";
  try {
    const { user, pass } = credentials;
    remote = new URL(remoteUrl);
    if (user) {
      remote.username = user;
      remote.password = pass;
    }
  } catch {
    remote = remoteUrl;
  }
  return remote.toString();
};
