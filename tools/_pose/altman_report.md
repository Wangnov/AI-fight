# Pose 分析报告：altman

- 检测成功：26/28
- 期望朝向：**right**

## 身份一致性（跨所有帧）
- 肩宽变异系数：**41.5%**（< 8% 一致；> 15% 严重不一致）
- 躯干长变异系数：**11.6%**
- 角色总身高变异系数：**12.4%**

## Idle vs Walk 高度对比
- idle 平均身高：0.6632
- walk 平均身高：0.6939
- 差异：**-4.4%**（>10% 表示明显脱节）

## Walk 8 帧（按帧序）
| frame | facing | front_foot | hip_y | leg_spread | body_h | shoulder_w |
|-------|--------|------------|-------|------------|--------|------------|
| 01 | right | R | 0.545 | 0.5932 | 0.7044 | 0.1291 |
| 02 | right | R | 0.5143 | 0.4402 | 0.6682 | 0.1783 |
| 03 | right | R | 0.5113 | 0.0942 | 0.7128 | 0.0522 |
| 04 | right | R | 0.517 | 0.3685 | 0.709 | 0.0568 |
| 05 | right | L | 0.536 | 0.6563 | 0.6678 | 0.0487 |
| 06 | right | R | 0.5558 | 0.4799 | 0.6571 | 0.2203 |
| 07 | right | R | 0.5143 | 0.0205 | 0.7252 | 0.0566 |
| 08 | right | L | 0.5222 | 0.3486 | 0.7068 | 0.0147 |

## 朝向异常帧（应该 right 但检测为别的）
- **altman_hit**: facing=left
- **altman_knockdown**: facing=left
- **altman_lean_back**: facing=left

## 检测失败 / 异常帧
- altman_crouch: NOT DETECTED
- altman_jump: NOT DETECTED

## Walk Cycle phase 推断（基于 hip 高度 + leg spread）
- leg_spread 最小（passing 候选）：altman_walk_07 (0.0205)
- leg_spread 最大（contact 候选）：altman_walk_05 (0.6563)
- hip_y 最小（up 候选 / 最高点）：altman_walk_03 (0.5113)
- hip_y 最大（down 候选 / 最低点）：altman_walk_06 (0.5558)