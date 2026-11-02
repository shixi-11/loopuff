# 编程游戏的复用与借鉴

核查日期：2026-11-03。依据官网、官方仓库和许可文件；本次没有完成这些游戏的实际试玩，也没有把第三方源码或素材接入环灵。下列适配判断是结合环灵当前源码作出的设计判断，不代表已经验证教学效果。

## 优先参考

| 产品 | 可以吸收的部分 | 在环灵中的用途 | 复用边界 |
| --- | --- | --- | --- |
| [Blockly Games](https://blockly.games/about?lang=en) | 从顺序、条件、循环、函数到文本编程的梯度；先提供有限指令，再撤掉提示 | 零基础航程；同一概念先预测、再修改、最后独立完成变式任务 | [官方代码](https://github.com/blockly-games/blockly-games)采用 Apache-2.0。若采用具体文件，保留许可、版权及适用通知，并标出修改；依赖和素材另核。现成生成器不能直接当作 Tolang 生成器 |
| [CodeCombat](https://codecombat.com/) | 代码直接控制场景行动、行动反馈和连续任务 | 警察／小偷追逐、机关、代码与角色行动对应的调试 | [官方法律页](https://codecombat.com/legal)区分：公开客户端代码为 MIT，供创建关卡的通用素材为 CC BY 4.0，具体关卡及专属内容保留权利。可选择兼容的开源模块，不复制官方关卡 |
| [Elevator Saga](https://play.elevatorsaga.com/) | 状态驱动的调度；同时考虑完成任务、等待和动作成本 | 星港运输、队列与多单位协作；在多组场景中检验同一策略 | [官方仓库](https://github.com/magwo/elevatorsaga)采用 MIT。`challenges.js` 中挑战配置与判定的分离值得吸收。仓库声明不再积极维护，旧依赖需要单独验证；JavaScript 回调不能直接充当 Tolang 语义 |
| [Screeps](https://store.screeps.com/) | 程序持续控制单位采集、建造、战斗 | 后期的自主角色、资源管理与协作任务 | [官方 engine 模块](https://github.com/screeps/engine)采用 ISC；这只证明该模块的许可，不覆盖整个商业产品、客户端和全部素材。优先借鉴持续策略的设计，暂不引入整套服务端 |
| [Lightbot](https://lightbot.com/) | 用少量指令理解顺序、过程和重复 | 开始写代码之前的短小操作练习，以及可复用的动作组合 | 本次未找到可供直接复制该商业游戏的开放许可；只参考机制，重新设计角色、谜题与界面 |
| [SHENZHEN I/O](https://www.zachtronics.com/shenzhen-io/) | 工程任务、随用随查的手册、由约束推动的编程 | Tolang 进阶项目与简洁的随堂参考；比较不同可行方案的取舍 | 本次未确认源码和关卡的开放许可；只参考设计，自行实现任务与内容 |

## 采用顺序

1. **先补可观察的执行。** 每次输出能对应到当前场景行动；可以逐步查看位置变化、路障阻挡和捕获发生在哪一步。改代码后旧轨迹立即失效，重新运行保持可重复。
2. **再补课程梯度。** 保留已有四课和存档标识。增加真正需要观察状态、解释结果、修复错误和独立迁移的任务；不能只换一组目标数字就称作新概念。
3. **以真实语义扩展 Tolang。** 新的类型、条件、循环、函数及消息协作，先验证对应语言行为，再扩展执行、错误提示、轨迹与评判。每种概念都要有独立于示例的正确解法和反例。当前入门解释器不能宣传成完整编译器或 TVM。
4. **在已有玩法中形成完整体验。** 追逐用于行动顺序和判断，机关用于重复与组合，调度用于资源与协作。每个玩法都应包含目标、观察、编写、执行、失败解释、调整和变式重玩；扩展游戏时不删掉警察／小偷跳路障。
5. **最后完善跨设备与长期挑战。** 草稿导出／导入、云存档和可信排行榜按现有路线单独实现，不让账号登录冒充进度同步，不把速度和游戏分数当作语言能力。

可复用的许可不等于直接兼容。引入具体文件前，固定来源提交、记录修改与许可证，验证依赖及移除方法，再由环灵的规则、课程和现有存档测试检查。环灵自己的代码许可不替代第三方原有许可。

## 核查锚点

- Blockly Games：`5d2ff6f39207f7ed31e3d11ba1de277c85efe4c2`；[许可证](https://github.com/blockly-games/blockly-games/blob/5d2ff6f39207f7ed31e3d11ba1de277c85efe4c2/LICENSE)。官方 About 分别说明 Maze 的循环与条件、Music 的函数，以及 Pond Tutor 的积木与 JavaScript 转换。
- Elevator Saga：`e0c55bf8cf59243c32dc371b2cc7b2e3ec1664af`；[许可证](https://github.com/magwo/elevatorsaga/blob/e0c55bf8cf59243c32dc371b2cc7b2e3ec1664af/LICENSE.txt)、[挑战定义](https://github.com/magwo/elevatorsaga/blob/e0c55bf8cf59243c32dc371b2cc7b2e3ec1664af/challenges.js)。
- Screeps engine：`a90d26fc9eb943147799e65d0bf9d4d0d79a2722`；[许可证](https://github.com/screeps/engine/blob/a90d26fc9eb943147799e65d0bf9d4d0d79a2722/LICENSE.txt)。
- CodeCombat：以[官方法律页](https://codecombat.com/legal)的代码、通用素材及保留关卡权利三部分为准；采用具体模块时再固定对应提交和文件。
