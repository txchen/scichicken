const utils = require('../backend/utils')

it('convert to friendly name', () => {
  expect(utils.classNameToFriendlyName('Item_Back_F_01_Lv2_C\u0000')[0]).toBe('2包')
  expect(utils.classNameToFriendlyName('Item_Jacket_C_01_C\u0000')[0]).toBe('')
  expect(utils.classNameToFriendlyName('Item_Weapon_Crossbow_C\u0000')[0]).toBe('')
  expect(utils.classNameToFriendlyName('Item_Attach_Weapon_Upper_DotSight_01_C\u0000')[0]).toBe('红点')
  expect(utils.classNameToFriendlyName('DroppedItemInteractionComponent\u0000')[0]).toBe('')
})
