# 环灵

[简体中文](README.zh.md) · [繁體中文](README.zh-Hant.md) · [English](README.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [العربية](README.ar.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

通过游戏学习编程与 Tolang。

读懂代码，预测结果，修改程序，再独立解决新的问题。

[shixilin.com/games/loopuff](https://shixilin.com/games/loopuff/zh/)

[保险库行动](https://shixilin.com/games/loopuff/zh/play/vault/)包含三道相连的机关。用计算结果开锁、尝试变量，再按顺序发送信号。支持更换线索重玩，保留草稿与三枚机关印记。

[星港调度](https://shixilin.com/games/loopuff/zh/play/dispatch/)：用条件、循环、函数与消息协作调度货物。每一轮都会带来新的调度数据。

[银行潜入](https://shixilin.com/games/loopuff/zh/play/heist/): 写一套会观察巡逻的策略，把箱子带出银行。每次判断，都接着上一刻的局势继续行动。

## 当前代码

十三个任务涵盖编程基础、Tolang 的条件、循环、函数与回复，以及消息和联合接收。每个任务都包含预测、解释、修改和独立编程环节；最初的四个任务还保留了飞行练习。课程和界面支持 11 种语言。程序在本地的受限教学解释器中运行，并非使用完整的 Tolang 编译器或 TVM。独立编程任务检查实际输出，以及指定概念是否参与产生该输出；打字速度不影响评分。

独立编程题提供百分制测评，分别检查程序运行、实际输出和题目要求。可以修改后重交，不按打字速度或是否照抄示例评分。

第四关用程序输出控制飞机的跳跃距离。运行代码，观察落点，再修改计算，让它抵达浮岛。

## 开发

```sh
npm test
npm run build
npm run dev
```

## 语言规范

界面、课程、考题、提示和错误信息使用所选语言。简体名为“环灵”，繁体名为“環靈”，其他语言统一使用 Loopuff。代码标识符和标点不翻译。阿拉伯文从右向左排版，代码始终从左向右。

## 许可

[PolyForm Noncommercial 1.0.0](LICENSE)

PolyForm Noncommercial 1.0.0。商业用途须另行取得书面授权。

由光之十一开发。
