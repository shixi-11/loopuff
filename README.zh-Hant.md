# 環靈

[English](README.md) · [简体中文](README.zh.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [العربية](README.ar.md)

透過遊戲學習程式設計與 Tolang。

讀懂程式碼、預測結果、修改程式，再獨立解決新的問題。

[shixilin.com/games/loopuff](https://shixilin.com/games/loopuff/zh-Hant/)

[保險庫行動](https://shixilin.com/games/loopuff/zh-Hant/play/vault/)包含三道相連的機關。用計算結果開鎖、嘗試變數，再按順序發送訊號。支援更換線索重玩，保留草稿與三枚機關印記。

[星港調度](https://shixilin.com/games/loopuff/zh-Hant/play/dispatch/)：用條件、迴圈、函式和協作訊息來安排貨物路線。每一輪都會帶來新的調度資料。

## 目前程式碼

十三個任務涵蓋程式設計基礎、Tolang 的條件、迴圈、函式與回覆，以及訊息和聯合接收。每個任務都包含預測、解釋、修改和獨立程式設計環節；最初的四個任務也保留了飛行練習。課程和介面支援 11 種語言。程式在本機的受限教學直譯器中執行，並非使用完整的 Tolang 編譯器或 TVM。獨立程式設計任務檢查實際輸出，以及指定概念是否參與產生該輸出；打字速度不影響評分。

獨立程式題提供百分制測評，分別檢查程式執行、實際輸出和題目要求。可以修改後重交，不依打字速度或是否照抄範例評分。

第四關用程式輸出控制飛機的跳躍距離。執行程式，觀察落點，再修改計算，讓它抵達浮島。

## 開發

```sh
npm test
npm run build
npm run dev
```

## 語言規範

介面、課程、測驗、提示和錯誤訊息使用所選語言。簡體名稱為「环灵」，繁體名稱為「環靈」，其他語言統一使用 Loopuff。程式碼識別字和標點不翻譯。阿拉伯文由右向左排版，程式碼始終由左向右。

## 授權

[PolyForm Noncommercial 1.0.0](LICENSE)

PolyForm Noncommercial 1.0.0。商業用途須另行取得書面授權。

由光之十一開發。
