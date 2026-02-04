// 分析原始结构：
// Line 731: { key: 'discover', value: { valueMap: [  -- 开始 discover 的 valueMap 数组
// Line 732:   { key: 'stage', value: { valueString: 'library' } },  -- 第1个元素
// Line 733:   { key: 'skills', value: { valueList: skills.map((s: any) => ({ valueMap: [  -- 第2个元素开始
// Line 734-739: 内部数组元素
// Line 740:   ]})) } },  -- 闭合: ] 闭合 valueMap 数组, }) 闭合 map 回调, ) 闭合 map 调用, } 闭合 valueList, } 闭合 value, }, 逗号分隔
// Line 741:   { key: 'hero', value: { valueMap: [  -- 第3个元素开始
// Line 742-747: 内部数组元素
// Line 748:   ]}} },  -- 应该是: ] 闭合 valueMap 数组, } 闭合 valueMap, } 闭合 value, }, 逗号分隔
// Line 749:   { key: 'gallery_refs', ... }  -- 第4个元素
// Line 750: ]}}  -- 闭合: ] 闭合 discover 的 valueMap 数组, } 闭合 valueMap, } 闭合 value

// 对比 Line 740 和 Line 748:
// Line 740: ]})) } },
//   - ] 闭合 valueMap 数组 (在 map 回调内)
//   - } 闭合 { valueMap: [...] } 对象
//   - ) 闭合 map 回调 (s: any) => ({...})
//   - ) 闭合 skills.map(...) 调用
//   - } 闭合 { valueList: ... } 对象
//   - } 闭合 value: {...} 对象
//   - }, 逗号分隔下一个元素

// Line 748 应该是: ]}} },
//   - ] 闭合 valueMap 数组
//   - } 闭合 { valueMap: [...] } 对象
//   - } 闭合 value: {...} 对象
//   - }, 逗号分隔下一个元素

// 当前 Line 748 是: ]}} },  这看起来是正确的！

// 让我检查 Line 741 的开始结构:
// { key: 'hero', value: { valueMap: [
// 这意味着需要闭合: ], }, }
// 所以 ]}} 是正确的

// 问题可能在于 esbuild 的解析方式。让我检查完整的嵌套结构。
