
import React from 'react';
import { createRoot } from 'react-dom/client';
// BẮT BUỘC: Phải có đuôi .tsx để trình duyệt nhận diện trong môi trường ESM
import App from './App.tsx';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Không tìm thấy phần tử 'root' để khởi tạo ứng dụng.");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("Trợ lý DVC đã khởi tạo thành công.");
  } catch (error) {
    console.error("Lỗi khi khởi tạo React:", error);
    rootElement.innerHTML = `<div style="padding:20px; color:red; font-family:sans-serif;">
      <b>Lỗi khởi tạo:</b><br>${error instanceof Error ? error.message : 'Lỗi không xác định'}<br>
      Bác hãy kiểm tra Console để biết thêm chi tiết.
    </div>`;
  }
}
