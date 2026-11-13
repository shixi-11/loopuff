# 环灵

[简体中文](README.zh.md) · [繁體中文](README.zh-Hant.md) · [English](README.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [العربية](README.ar.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

通过游戏学习编程与 Tolang。

读懂代码，预测结果，修改程序，再独立解决新的问题。

[shixilin.com/games/loopuff](https://shixilin.com/games/loopuff/zh/)

[游乐街区](https://shixilin.com/games/loopuff/zh/play/) · [零基础路线](https://shixilin.com/games/loopuff/zh/guide/start/) · [进阶路线](https://shixilin.com/games/loopuff/zh/guide/advance/) · [排行榜](https://shixilin.com/games/loopuff/zh/leaderboard/)

街区上下两排共八家店：六家对应方块下落、坦克防卫、星际巡逻、贪吃蛇、打砖块和推箱子，另两家通向编程入门与概念地图。可以先用按钮熟悉玩法，再用 Tolang 选择卡带、开始、操控、暂停或结束游戏。账号支持核验后的游戏成绩、排行榜和一次性星币成就；学习进度由使用者手动保存与恢复。

两条学习路线分别从第一条指令和已有编程基础出发。零基础路线有十一项可运行练习：显示数字、修改、修错、计算、绑定名字、按分数判断、选择游戏、按顺序移动开火、循环移动、结束游戏和自动落块策略。进阶路线结合九类多输入诊断、函数与消息示例，以及六种游戏的策略目标。旧练习入口与既有存档继续保留。

## 当前代码

十三个任务涵盖编程基础、Tolang 的条件、循环、函数与回复，以及消息和联合接收。每个任务都包含预测、解释、修改和独立编程环节；最初的四个任务还保留了飞行练习。课程和界面支持 12 种语言。程序在本地的受限教学解释器中运行，并非使用完整的 Tolang 编译器或 TVM。独立编程任务检查实际输出，以及指定概念是否参与产生该输出；打字速度不影响评分。

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
