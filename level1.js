levels.push({
  robot: {
    position: [50, 800],
    hasBlueGun: false,
    hasYellowGun: false
  },
  blocks: [
    { position: [800, 1000], scale: [50, 5] },
    { position: [800, 400], scale: [50, 5] }
  ],
  killers: [
    { position: [1200, 850], speed: [-250, 0] },
    { position: [1200, 800], speed: [-250, 0] },
    { position: [1200, 600], speed: [-250, 0] },
    { position: [1200, 550], speed: [-250, 0] },
    { position: [1500, 850], speed: [250, 0] },
    { position: [1500, 800], speed: [250, 0] },
    { position: [1500, 600], speed: [250, 0] },
    { position: [1500, 550], speed: [250, 0] }
  ],
  victory: { position: [1500, 700], scale: [1, 28] }
});
