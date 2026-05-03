# Pose 分析报告：altman

- 检测成功：26/28
- 期望朝向：**right**

## 身份一致性（跨所有帧）
- 肩宽变异系数：**24.5%**（< 8% 一致；> 15% 严重不一致）
- 躯干长变异系数：**17.8%**
- 角色总身高变异系数：**10.8%**

## Idle vs Walk 高度对比
- idle 平均身高：0.6632
- walk 平均身高：0.6107
- 差异：**8.6%**（>10% 表示明显脱节）

## Walk 8 帧（按帧序）
| frame | facing | front_foot | hip_y | leg_spread | body_h | shoulder_w |
|-------|--------|------------|-------|------------|--------|------------|
| 01 | right | L | 0.5007 | 0.4308 | 0.6121 | 0.1695 |
| 02 | right | L | 0.4839 | 0.4112 | 0.5821 | 0.1527 |
| 03 |  left | L | 0.4601 | 0.0023 | 0.6183 | 0.1423 |
| 04 | right | L | 0.4842 | 0.3452 | 0.6346 | 0.1441 |
| 05 | right | L | 0.4861 | 0.4249 | 0.6343 | 0.16 |
| 06 | right | L | 0.4635 | 0.3849 | 0.6304 | 0.1434 |
| 07 | right | L | 0.4881 | 0.2726 | 0.5512 | 0.1452 |
| 08 | right | L | 0.4571 | 0.2652 | 0.6226 | 0.1404 |

## 朝向异常帧（应该 right 但检测为别的）
- **altman_hit**: facing=left
- **altman_knockdown**: facing=left
- **altman_lean_back**: facing=left
- **altman_walk_03**: facing=left

## 检测失败 / 异常帧
- altman_crouch: NOT DETECTED
- altman_jump: NOT DETECTED

## Walk Cycle phase 推断（基于 hip 高度 + leg spread）
- leg_spread 最小（passing 候选）：altman_walk_03 (0.0023)
- leg_spread 最大（contact 候选）：altman_walk_01 (0.4308)
- hip_y 最小（up 候选 / 最高点）：altman_walk_08 (0.4571)
- hip_y 最大（down 候选 / 最低点）：altman_walk_01 (0.5007)