
const getApi = () => {
  if (typeof chrome !== 'undefined' && chrome.runtime) return chrome;
  if (typeof browser !== 'undefined' && browser.runtime) return browser;
  return null;
};

const api = getApi();

if (api) {
  const actionApi = api.action || api.browserAction;
  
  actionApi.onClicked.addListener(async (tab) => {
    if (!tab.id || tab.url.startsWith('chrome://') || tab.url.startsWith('orion://')) return;

    try {
      // 1. Kiểm tra xem script đã nạp chưa bằng cách gửi message
      await api.tabs.sendMessage(tab.id, { action: "TOGGLE_WIDGET" });
    } catch (err) {
      // 2. Nếu lỗi (Context invalidated hoặc chưa inject), tiến hành inject lại
      console.log("Đang nạp lại script trợ lý...");
      try {
        await api.scripting.executeScript({
          target: { tabId: tab.id, allFrames: false },
          files: ['content.js']
        });
        // 3. Chờ một chút rồi mở lại
        setTimeout(() => {
          api.tabs.sendMessage(tab.id, { action: "TOGGLE_WIDGET" });
        }, 200);
      } catch (injectErr) {
        console.error("Trang web không cho phép chạy trợ lý:", injectErr);
      }
    }
  });
}
