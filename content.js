
(function() {
  if (window.dvcExtractorLoaded) return;
  window.dvcExtractorLoaded = true;

  const getApi = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) return chrome;
    if (typeof browser !== 'undefined' && browser.runtime) return browser;
    return null;
  };

  const api = getApi();
  let widgetIframe = null;
  let isVisible = false;

  /**
   * ============================================================
   * CẤU HÌNH GIAO DIỆN NỔI (WIDGET)
   * ============================================================
   */
  const WIDGET_WIDTH = "380px";   // Độ rộng của khung trợ lý
  const WIDGET_HEIGHT = "630px";  // Chiều cao của khung trợ lý
  const HIGHLIGHT_COLOR = "#d4af37"; // Màu viền khi trợ lý đang điền hồ sơ (vàng đồng)
  /**
   * ============================================================
   */

  // Khôi phục trạng thái hiển thị của Widget khi nạp lại trang
  if (api) {
    api.storage.local.get(['dvc_widget_visible', 'dvc_widget_pos'], (res) => {
      if (res.dvc_widget_visible) {
        isVisible = true;
        createWidget();
        
        if (res.dvc_widget_pos && widgetIframe) {
          widgetIframe.style.top = res.dvc_widget_pos.top;
          widgetIframe.style.left = res.dvc_widget_pos.left;
          widgetIframe.style.right = 'auto';
        }
        
        widgetIframe.style.display = 'block';
        widgetIframe.style.transform = 'scale(1)';
        widgetIframe.style.opacity = '1';
      }
    });
  }

  function createWidget() {
    if (document.getElementById('dvc-assistant-container')) return;
    
    const container = document.createElement('div');
    container.id = 'dvc-assistant-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: ${WIDGET_WIDTH};
      height: ${WIDGET_HEIGHT};
      z-index: 2147483647;
      box-shadow: 0 25px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(212, 175, 55, 0.4);
      border-radius: 20px;
      overflow: hidden;
      display: none;
      background: white;
      opacity: 0;
      transform: scale(0.9);
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
    `;

    // Khu vực nắm kéo Widget
    const handle = document.createElement('div');
    handle.id = 'dvc-drag-handle';
    handle.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 52px;
      cursor: grab;
      z-index: 100;
    `;
    
    container.appendChild(handle);

    const iframe = document.createElement('iframe');
    iframe.src = api ? api.runtime.getURL('index.html') : '';
    iframe.style.cssText = `width: 100%; height: 100%; border: none; pointer-events: auto;`;
    container.appendChild(iframe);
    document.body.appendChild(container);

    widgetIframe = container;
    setupDragging(container, handle);
  }

  function setupDragging(el, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = (e) => {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = () => {
        document.onmouseup = null;
        document.onmousemove = null;
        // Lưu vị trí bác đã kéo tới để lần sau nạp lại đúng chỗ đó
        if (api) api.storage.local.set({ dvc_widget_pos: { top: el.style.top, left: el.style.left } });
      };
      document.onmousemove = (e) => {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        el.style.top = (el.offsetTop - pos2) + "px";
        el.style.left = (el.offsetLeft - pos1) + "px";
        el.style.right = 'auto';
      };
    };
  }

  if (api) {
    api.runtime.onMessage.addListener((msg) => {
      if (msg.action === "TOGGLE_WIDGET") {
        if (!widgetIframe) createWidget();
        isVisible = !isVisible;
        api.storage.local.set({ dvc_widget_visible: isVisible });
        
        if (isVisible) {
          widgetIframe.style.display = 'block';
          widgetIframe.offsetHeight;
          widgetIframe.style.transform = 'scale(1)';
          widgetIframe.style.opacity = '1';
        } else {
          widgetIframe.style.transform = 'scale(0.8)';
          widgetIframe.style.opacity = '0';
          setTimeout(() => { if (!isVisible) widgetIframe.style.display = 'none'; }, 300);
        }
      }
    });
  }

  window.addEventListener("message", async (event) => {
    if (!widgetIframe) return;
    const iframe = widgetIframe.querySelector('iframe');
    
    // Gửi dữ liệu quét trang web cho Trợ lý
    if (event.data.type === "DVC_REQUEST_SCAN") {
      const data = scanFrame();
      iframe.contentWindow.postMessage({ type: "DVC_SCAN_RESULT", data }, "*");
    }

    // Thực hiện 1 bước điền hồ sơ
    if (event.data.type === "DVC_REQUEST_STEP") {
      const success = await executeStep(event.data.step);
      iframe.contentWindow.postMessage({ type: "DVC_STEP_RESULT", success }, "*");
    }

    // Đóng Widget
    if (event.data.type === "DVC_CLOSE_WIDGET") {
      isVisible = false;
      if (api) api.storage.local.set({ dvc_widget_visible: false });
      widgetIframe.style.transform = 'scale(0.8)';
      widgetIframe.style.opacity = '0';
      setTimeout(() => { widgetIframe.style.display = 'none'; }, 300);
    }
  });

  async function executeStep(s) {
    try {
      const el = document.querySelector(s.selector);
      if (!el) return false;
      
      // Cuộn trang tới vị trí đang điền để bác thấy
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Hiệu ứng làm nổi bật ô đang điền
      const originalOutline = el.style.outline;
      const originalBg = el.style.backgroundColor;
      el.style.outline = `5px solid ${HIGHLIGHT_COLOR}`;
      el.style.backgroundColor = 'rgba(212, 175, 55, 0.1)';
      
      await new Promise(r => setTimeout(r, 600)); // Chờ cuộn trang xong
      
      const action = (s.action || '').toLowerCase();
      if (action === 'click') {
        el.click();
      } else if (['fill', 'type', 'input', 'value'].includes(action)) {
        el.value = s.value || '';
        // BẮT BUỘC: Kích hoạt các sự kiện để hệ thống DVC nhận diện thay đổi
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      
      // Xóa hiệu ứng sau khi điền xong
      setTimeout(() => {
        el.style.outline = originalOutline;
        el.style.backgroundColor = originalBg;
      }, 1000);

      return true;
    } catch (e) { return false; }
  }

  // Quét toàn bộ các ô nhập liệu và nút bấm trên trang hiện tại
  function scanFrame() {
    try {
      return {
        url: window.location.href,
        inputs: Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea')).map(el => ({
          tag: el.tagName.toLowerCase(), 
          id: el.id || null, 
          label: findLabel(el)
        })),
        buttons: Array.from(document.querySelectorAll('button, .btn, [role="button"]')).map(el => ({
          text: el.innerText?.trim() || el.value || ''
        }))
      };
    } catch (err) { return null; }
  }

  function findLabel(el) {
    const container = el.closest('.form-group, label, .ant-form-item, .row, .col-md-12');
    if (container) {
      const labelEl = container.querySelector('label, .label-text, .title, b');
      if (labelEl) return labelEl.innerText.trim();
    }
    return el.placeholder || el.getAttribute('aria-label') || null;
  }
})();
