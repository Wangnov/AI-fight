# Pose 分析报告：dario

- 检测成功：26/27
- 期望朝向：**left**

## 身份一致性（跨所有帧）
- 肩宽变异系数：**29.6%**（< 8% 一致；> 15% 严重不一致）
- 躯干长变异系数：**10.7%**
- 角色总身高变异系数：**9.7%**

## Idle vs Walk 高度对比
- idle 平均身高：0.6424
- walk 平均身高：0.688
- 差异：**-6.6%**（>10% 表示明显脱节）

## Walk 8 帧（按帧序）
| frame | facing | front_foot | hip_y | leg_spread | body_h | shoulder_w |
|-------|--------|------------|-------|------------|--------|------------|
| 01 |  left | L | 0.5749 | 0.5302 | 0.6914 | 0.1711 |
| 02 |  left | L | 0.5363 | 0.4331 | 0.6377 | 0.2198 |
| 03 |  left | R | 0.5228 | 0.1595 | 0.7103 | 0.0411 |
| 04 |  left | R | 0.5174 | 0.3977 | 0.6996 | 0.0254 |
| 05 |  left | L | 0.5805 | 0.5754 | 0.6835 | 0.1922 |
| 06 |  left | L | 0.5523 | 0.4747 | 0.653 | 0.1969 |
| 07 |  left | L | 0.5271 | 0.0378 | 0.717 | 0.12 |
| 08 |  left | L | 0.5495 | 0.3624 | 0.7111 | 0.1355 |

## 朝向异常帧（应该 left 但检测为别的）
- **dario_hit**: facing=right
- **dario_lose**: facing=right

## 检测失败 / 异常帧
- dario_crouch: NOT DETECTED

## Walk Cycle phase 推断（基于 hip 高度 + leg spread）
- leg_spread 最小（passing 候选）：dario_walk_07 (0.0378)
- leg_spread 最大（contact 候选）：dario_walk_05 (0.5754)
- hip_y 最小（up 候选 / 最高点）：dario_walk_04 (0.5174)
- hip_y 最大（down 候选 / 最低点）：dario_walk_05 (0.5805)