# Mortal 集成与使用指南

本指南面向“需要在另一个项目中调用 Mortal”的开发者。

它不关注模型训练细节，而是聚焦以下问题：

- Mortal 是什么，适合放在系统中的哪一层
- 运行 Mortal 最少需要准备哪些文件
- 如何以普通推理模式接入
- 如何开启 `review mode`
- 没有 `GRP` 权重时能做什么，有了它又能多做什么
- 集成时最常见的坑是什么

## 1. 项目定位

Mortal 是一个基于深度强化学习的日本麻将 AI。

从集成角度看，它通常被拆成两层：

- `libriichi`：Rust 写的麻将逻辑与 Python 扩展
- `mortal`：Python 推理、训练、复盘分析逻辑

对外最常见的接入方式不是导入一个稳定的 Python SDK，而是：

1. 由外部项目生成 `mjai` 事件流
2. 启动 `python mortal.py <player_id>`
3. 通过标准输入喂入逐行 JSON
4. 从标准输出读取 AI 的动作 JSON

如果你的项目只是“需要一个日麻决策引擎”，那么通常只需要 `mortal.py` 这条链路。

## 2. 适合的接入场景

Mortal 适合以下几类系统：

- 牌谱复盘工具
- 实时对局分析工具
- Mahjong Soul / Tenhou / 自定义麻将协议到 `mjai` 的桥接程序
- 需要“输入局面，输出建议动作”的本地或远程服务

Mortal 不适合直接当作一个零配置的桌面终端用户应用。它更像一个“可被其他项目调用的 AI 引擎”。

## 3. 必需文件

最小可运行的普通推理环境需要这些内容：

- 仓库源码
- Python 环境
- PyTorch
- Rust 工具链
- 编译后的 `libriichi` Python 扩展
- 一个可用的 Mortal 模型权重文件
- `mortal/config.toml`

如果要开启 `review mode`，还需要额外准备：

- `GRP` 权重文件

## 4. 模型文件说明

### 4.1 普通推理权重

普通推理至少需要一个 `state_file`，也就是 `config.toml` 中的：

```toml
[control]
state_file = "/path/to/mortal.pth"
```

当前仓库的推理逻辑会从该文件中读取：

- `mortal`
- `current_dqn`
- `config`

推荐优先使用“完整 checkpoint”，通常文件名类似：

- `mortal.pth`
- `bot_xxx_best.zip` 中解压出的 `mortal.pth`

这类文件通常兼容性最好。

### 4.2 精简权重

有些模型包只包含精简 `.pth`，例如只保留推理所需参数。它们有时也可以用，但可能缺少：

- `timestamp`
- `tag`
- 训练态元数据

如果你自己的接入程序依赖这些字段，需要先确认格式。

### 4.3 GRP 权重

`GRP` 不是普通出牌推理必须的权重。

它主要用于：

- `review mode`
- 名次概率矩阵计算
- 基于名次概率的 reward 推导
- 部分训练流程

没有它时，普通出牌建议仍然可以工作。

## 5. 环境准备

## 5.1 创建 Python 环境

仓库已经提供了基础 `environment.yml`。你还需要自行安装适合当前机器的 PyTorch。

示例：

```powershell
conda env create -f environment.yml
conda activate mortal
```

然后根据你的 CPU / CUDA 环境安装 `torch`。

## 5.2 编译 `libriichi`

在仓库根目录执行：

```powershell
cargo build -p libriichi --lib --release
```

Windows 下将编译产物复制为：

```powershell
Copy-Item target\release\riichi.dll mortal\libriichi.pyd
```

Linux 下通常对应：

```bash
cp target/release/libriichi.so mortal/libriichi.so
```

## 5.3 准备配置文件

复制模板：

```powershell
Copy-Item mortal\config.example.toml mortal\config.toml
```

最小普通推理配置至少要保证：

```toml
[control]
state_file = "/path/to/mortal.pth"
```

如果你只做普通推理，其它训练配置可以先不填。

如果要开启 `review mode`，还需要：

```toml
[grp]
state_file = "/path/to/grp.pth"

[grp.network]
hidden_size = 64
num_layers = 2
```

注意：

- `config.py` 默认读取当前工作目录下的 `config.toml`
- 也可以通过环境变量 `MORTAL_CFG` 指定其他路径

## 6. 最小启动方式

最常见的运行方式是在 `mortal/` 目录启动：

```powershell
cd mortal
python mortal.py 0
```

其中：

- `0` 是玩家 ID
- 合法范围是 `0` 到 `3`

程序从标准输入读取 `mjai` 事件流。

## 7. 输入输出协议

## 7.1 输入

输入必须是逐行 JSON，也就是 newline-delimited JSON。每一行是一条 `mjai` 事件。

例如：

```json
{"type":"start_game"}
{"type":"start_kyoku","bakaze":"E","dora_marker":"1m","kyoku":1,"honba":0,"kyotaku":0,"oya":0,"scores":[25000,25000,25000,25000],"tehais":[["1m","2m","3m","4m","5m","6m","7m","8m","9m","1p","2p","3p","4p"],["?","?","?","?","?","?","?","?","?","?","?","?","?"],["?","?","?","?","?","?","?","?","?","?","?","?","?"],["?","?","?","?","?","?","?","?","?","?","?","?","?"]]}
{"type":"tsumo","actor":0,"pai":"5p"}
```

## 7.2 输出

程序只会在“当前事件需要 AI 反应”时输出 JSON。例如：

```json
{"type":"reach","actor":0,"meta":{"q_values":[...],"mask_bits":137438969855,"is_greedy":true,"batch_size":1,"eval_time_ns":33740200,"shanten":0,"at_furiten":false}}
```

常见输出类型包括：

- `dahai`
- `reach`
- `pon`
- `chi`
- `kan`
- `hora`
- `ryukyoku`
- `none`（仅 `review mode` 下会补）

`meta` 字段是 Mortal 自己加的扩展信息，不是 `mjai` 标准的一部分。

## 8. 推荐的集成方式

## 8.1 方式一：子进程 + 标准输入输出

这是最简单、最稳的方式。

外部项目负责：

- 把局面转换成 `mjai`
- 启动 `mortal.py`
- 逐行写入 stdin
- 逐行读取 stdout

Python 示例：

```python
import subprocess
import sys

proc = subprocess.Popen(
    [sys.executable, "mortal.py", "0"],
    cwd=r"D:\Code\MahjongLab\Mortal\mortal",
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
)

proc.stdin.write('{"type":"start_game"}\n')
proc.stdin.flush()

line = proc.stdout.readline()
print(line)
```

适用场景：

- 复盘程序
- 本地分析器
- GUI 程序
- 网关 / 桥接服务

## 8.2 方式二：长生命周期进程

如果你的系统会持续处理多局数据，建议不要每次请求都启动一次 Mortal。

更合理的方式是：

- 进程启动时加载模型
- 每局创建或重置一条 bot 会话
- 按事件流持续喂入

这样能显著减少模型加载开销。

## 8.3 方式三：Docker

如果你更关心部署隔离，可以使用项目自带的 Docker 方案。

但要注意：

- 镜像本身不包含模型文件
- 仍然需要把模型目录挂载进去
- 该 Docker 文件主要面向推理，不是训练

## 9. `review mode`

## 9.1 作用

`review mode` 主要给复盘和报告系统使用，而不是给实时出牌调用。

它会在普通推理基础上多做三件事：

- 保存整段输入日志
- 对没有动作的事件补一条 `none`
- 在处理完成后输出一条带 `phi_matrix` 的总结 JSON

开启方式：

```powershell
$env:MORTAL_REVIEW_MODE = 1
python mortal.py 0
```

## 9.2 没有 `GRP` 时会怎样

没有 `GRP` 权重时：

- 普通推理仍然可用
- `review mode` 最后的分析输出不可用
- 依赖 `GRP` 的训练数据 reward 计算也不可用

## 9.3 有了 `GRP` 后能多输出什么

`review mode` 结束时会额外输出：

- `model_tag`
- `phi_matrix`

其中 `phi_matrix` 可以理解成：

- 对局若干阶段点上
- 4 个玩家
- 各自拿到 1 / 2 / 3 / 4 名的概率

也就是一个“名次概率矩阵”。

这类信息适合：

- 局势走势展示
- 复盘报告
- 期望 pt / rank 分析

## 10. 典型配置模板

## 10.1 只做普通推理

```toml
[control]
state_file = "/models/mortal.pth"
```

## 10.2 开启复盘分析

```toml
[control]
state_file = "/models/mortal.pth"

[grp]
state_file = "/models/grp.pth"

[grp.network]
hidden_size = 64
num_layers = 2
```

## 11. 模型选择建议

如果你同时拿到了多种模型包，建议优先级如下：

1. 先试完整 checkpoint，例如 `mortal.pth`
2. 再试 `best` 版本
3. 最后再考虑 `min` 或精简版模型

原因：

- 完整 checkpoint 与本仓库原始脚本通常兼容性最好
- `best` 通常表示训练过程中表现最好的快照
- 精简版模型往往更适合“只做推理”的定制接入，不一定保留所有元数据

## 12. 常见问题

## 12.1 `import libriichi` 失败

通常是以下原因之一：

- `libriichi.pyd` / `libriichi.so` 没放到 `mortal/` 目录
- Python 版本与编译产物 ABI 不匹配
- 没有成功执行 `cargo build -p libriichi --lib --release`

## 12.2 checkpoint 加载失败

常见原因：

- 权重文件不是当前模型结构对应的版本
- 使用了不兼容的精简 checkpoint
- PyTorch 版本较新，默认 `weights_only=True` 更严格

当前仓库中的 `load_torch()` 已经兼容较新的 PyTorch 行为；如果你在别的项目中复用加载逻辑，建议一并复用该封装。

## 12.3 `review mode` 报找不到 `grp`

原因通常是：

- 没有 `grp.pth`
- `config.toml` 没配置 `[grp].state_file`
- `grp.network` 与权重结构不匹配

## 12.4 输入日志解析失败

最常见原因：

- 输入不是逐行 JSON
- 前面混入了日志文本或 shell 输出
- 输入带 UTF-8 BOM
- 玩家视角 `player_id` 不匹配

在 Windows 下，建议优先使用程序内子进程通信，不要依赖复杂 shell 管道拼接。

## 12.5 没有输出

这并不一定是错误。

Mortal 只有在当前事件需要反应时才会输出动作。普通模式下，对于不需要响应的事件，stdout 本来就可能是空的。

## 13. 给外部项目的落地建议

如果你是在另一个项目里接入 Mortal，建议按这个顺序推进：

1. 先在命令行跑通最小 `mjai` 输入
2. 再用你自己的程序通过 `subprocess` 调用
3. 再补日志记录、异常处理和超时控制
4. 需要复盘报告时再接 `review mode`
5. 真正需要训练或 reward 分析时再补 `GRP`

多数项目并不需要一开始就接入训练链路。

如果你的目标只是“给当前局面出建议动作”，普通推理已经足够。
