# Pose 分析报告：dario

- 检测成功：26/27
- 期望朝向：**left**

## 身份一致性（跨所有帧）
- 肩宽变异系数：**14.6%**（< 8% 一致；> 15% 严重不一致）
- 躯干长变异系数：**14.4%**
- 角色总身高变异系数：**8.8%**

## Idle vs Walk 高度对比
- idle 平均身高：0.6424
- walk 平均身高：0.5929
- 差异：**8.4%**（>10% 表示明显脱节）

## Walk 8 帧（按帧序）
| frame | facing | front_foot | hip_y | leg_spread | body_h | shoulder_w |
|-------|--------|------------|-------|------------|--------|------------|
| 01 |  left | R | 0.4987 | 0.3084 | 0.6031 | 0.1571 |
| 02 |  left | R | 0.498 | 0.3041 | 0.6042 | 0.1618 |
| 03 |  left | R | 0.501 | 0.0396 | 0.626 | 0.1676 |
| 04 |  left | R | 0.508 | 0.3488 | 0.5663 | 0.1683 |
| 05 |  left | R | 0.5093 | 0.3869 | 0.5609 | 0.1699 |
| 06 |  left | R | 0.4969 | 0.3179 | 0.5801 | 0.1652 |
| 07 |  left | L | 0.4777 | 0.0795 | 0.6086 | 0.1661 |
| 08 |  left | R | 0.5008 | 0.3363 | 0.5937 | 0.1814 |

## 朝向异常帧（应该 left 但检测为别的）
- **dario_hit**: facing=right
- **dario_lose**: facing=right

## 检测失败 / 异常帧
- dario_crouch: NOT DETECTED

## Walk Cycle phase 推断（基于 hip 高度 + leg spread）
- leg_spread 最小（passing 候选）：dario_walk_03 (0.0396)
- leg_spread 最大（contact 候选）：dario_walk_05 (0.3869)
- hip_y 最小（up 候选 / 最高点）：dario_walk_07 (0.4777)
- hip_y 最大（down 候选 / 最低点）：dario_walk_05 (0.5093)