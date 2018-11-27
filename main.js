var config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1200 }
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  backgroundColor: "#999999"
};

var that;

var ROBOT_SPEED = 400;
var ROBOT_JUMP = 600;
var LASER_SPEED = 3500;
var MAX_ROBOT_SPEED = 2500;

var currentLevel = 0;
var currentDeathRate = 0;

var gladosBlink;
var isPaused = false;

var cursors;
var robot;
var blocks;
var killers;
var reverser;
var victory;
var portal_blue;
var laser_blue;
var portal_yellow;
var laser_yellow;
var safezones;

var blocksCollider;

var isMoving = false;

var sound_effect;

var game = new Phaser.Game(config);

function preload() {
  that = this;

  this.load.audio("space_music", ["assets/ObservingTheStar.ogg"]);
  this.load.audio("space_sound_effect", ["assets/highUp.mp3"]);

  this.load.image("block_white", "assets/50x50-white.png");
  this.load.image("block_black", "assets/50x50-black.png");
  this.load.image("block_red", "assets/24x24-red.png");
  this.load.image("block_green", "assets/50x50-green.png");

  this.load.image("robot", "assets/50x50-pink.png");
  this.load.image("glados", "assets/glados.png");

  this.load.image("victory", "assets/12x12-green.png");

  this.load.image("portal_blue", "assets/12x12-blue.png");
  this.load.image("portal_yellow", "assets/12x12-yellow.png");

  this.load.image("reverser", "assets/12x12-check.png");
}

function loadLevel(level) {
  isPaused = false;
  if (!level) return;

  // Add the sprite for the robot
  const [rX, rY] = level.robot.position;
  robot = that.physics.add.sprite(rX, rY, "robot");

  // Add blocks to the board
  blocks = that.physics.add.group({
    immovable: true,
    allowGravity: false
  });

  blocks.create(-25, 600, "block_white").setScale(1, 26);
  blocks.create(1625, 600, "block_white").setScale(1, 26);
  blocks.create(800, -25, "block_white").setScale(32, 1);
  blocks.create(800, 1125, "block_white").setScale(32, 1);

  if (level.blocks) {
    level.blocks.forEach(block => {
      const [x, y] = block.position;
      const [sX, sY] = block.scale;
      blocks.create(x, y, "block_black").setScale(sX, sY);
    });
  }

  blocksCollider = that.physics.add.collider(robot, blocks);

  // Add Safe zones to the board
  safezones = that.physics.add.group({
    immovable: true,
    allowGravity: false
  });

  if (level.safezones) {
    level.safezones.forEach(safe => {
      const [x, y] = safe.position;
      const [sX, sY] = safe.scale;
      safezones
        .create(x, y, "block_green")
        .setScale(sX, sY)
        .setAlpha(0.3);
    });
  }

  // Gravity Reverser
  reverser = that.physics.add.group({
    immovable: true,
    allowGravity: false
  });

  if (level.reversers) {
    level.reversers.forEach(block => {
      const [x, y] = block.position;
      reverser.create(x, y, "reverser").setScale(2, 1);
    });
  }

  // Killers
  killers = that.physics.add.group({
    immovable: false,
    allowGravity: false
  });

  if (level.killers) {
    level.killers.forEach(killer => {
      const [x, y] = killer.position;
      const [vX, vY] = killer.speed;
      const k = killers.create(x, y, "block_red");
      k.setVelocity(vX, vY);
      k.setBounce(1);
    });
  }
  that.physics.add.collider(killers, blocks);
  that.physics.add.collider(killers, safezones);
  that.physics.add.collider(killers, robot, robotDeath);
  that.physics.add.collider(reverser, robot, x => {
    that.physics.world.gravity.y *= -1;
  });

  // Add static image for victory condition
  const [x, y] = level.victory.position;
  const [sX, sY] = level.victory.scale;
  victory = that.physics.add
    .staticImage(x, y, "victory")
    .setScale(sX, sY)
    .refreshBody();
  that.physics.add.overlap(robot, victory, levelWon);

  // Resets the portals
  portal_blue = null;
  if (level.portal_blue) {
    const [x, y] = level.portal_blue.position;
    const [sX, sY] = level.portal_blue.scale;
    portal_blue = that.physics.add
      .staticImage(x, y, "portal_blue")
      .setScale(sX, sY)
      .refreshBody();
    portal_blue._DIRECTION = level.portal_blue.direction;
    that.physics.add.overlap(portal_blue, robot, teleportTo("yellow"));
  }
  portal_yellow = null;
  if (level.portal_yellow) {
    const [x, y] = level.portal_yellow.position;
    const [sX, sY] = level.portal_yellow.scale;
    portal_yellow = that.physics.add
      .staticImage(x, y, "portal_yellow")
      .setScale(sX, sY)
      .refreshBody();
    portal_yellow._DIRECTION = level.portal_yellow.direction;
    that.physics.add.overlap(portal_yellow, robot, teleportTo("blue"));
  }

  // Physic group for lasers
  laser_blue = that.physics.add.group();
  laser_yellow = that.physics.add.group();
  that.physics.add.collider(laser_blue, blocks, makePortal("blue"));
  that.physics.add.collider(laser_yellow, blocks, makePortal("yellow"));
  initCollider();
}

function levelWon() {
  currentLevel = currentLevel + 1;
  pauseWithDialog("You won!", () => that.scene.restart());
}

function displayHud() {
  graphics = that.add.graphics();
  graphics.fillStyle(0x000e54, 1.0);
  graphics.fillRoundedRect(0, -100, 1600, 100, { tl: 0, tr: 0, bl: 0, br: 0 });

  var style = {
    font: "bold 64px Arial",
    fill: "#fff",
    boundsAlignH: "center",
    boundsAlignV: "middle"
  };

  textHudLevel = that.add
    .text(20, -80, "Level: " + currentLevel, style)
    .setOrigin(0, 0);
  textHudLevel.setShadow(3, 3, "rgba(0,0,0,0.5)", 2);

  textHudDeath = that.add
    .text(1580, -80, "Death: " + currentDeathRate, style)
    .setOrigin(1, 0);
  textHudDeath.setShadow(3, 3, "rgba(0,0,0,0.5)", 2);

  glados = that.add.sprite(1600 / 2, -98, "glados");
  glados.setOrigin(0.5, 0);
  glados.setScale(0.8);

  gladosBlink = that.add.graphics();
  gladosBlink.fillStyle(0x222222, 1.0);
  gladosBlink.fillCircle(1600 / 2 - 2, -38, 8, 8);
}

function create() {
  this.cameras.main.setBounds(0, -100, 1600, 1400);
  this.physics.world.setBounds(0, 0, 1600, 1200);

  // Register the keyboard for receiving inputs
  cursors = this.input.keyboard.createCursorKeys();

  // Starts playing an amazing
  // this.sound.add("space_music", { loop: true }).play();
  sound_effect = this.sound.add("space_sound_effect", { loop: false });

  // Camera :)
  this.cameras.main.setZoom(0.5);

  // Level
  loadLevel(levels[currentLevel]);
  that.input.on("pointerup", shootLaser);

  // Hud
  displayHud();
}

const pauseWithDialog = (dialog, callback) => {
  that.physics.pause();
  isPaused = true;

  graphics = that.add.graphics();
  graphics.fillStyle(0xffff00, 0.2);
  graphics.fillRect(0, 0, 1600, 1200);

  var style = {
    font: "bold 164px Arial",
    fill: "#fff",
    boundsAlignH: "center",
    boundsAlignV: "middle"
  };

  text = that.add.text(800, 500, dialog, style).setOrigin(0.5, 0.5);
  text.setShadow(3, 3, "rgba(0,0,0,0.5)", 2);

  that.input.keyboard.on("keydown", callback);
};

const robotDeath = () => {
  currentDeathRate += 1;
  pauseWithDialog("You're dead", () => that.scene.restart());
};

const initCollider = () => {
  if (blocksCollider) blocksCollider.destroy();
  blocksCollider = that.physics.add.collider(robot, blocks);
};

const makePortal = color => laser => {
  const otherColor = color == "blue" ? "yellow" : "blue";
  var new_portal = that.physics.add.staticImage(
    laser.x,
    laser.y,
    "portal_" + color
  );
  that.physics.add.overlap(new_portal, robot, teleportTo(otherColor));
  //that.physics.add.overlap(new_portal, killers, teleportTo(otherColor));

  if (laser.body.touching.right) {
    new_portal._DIRECTION = "LEFT";
  } else if (laser.body.touching.left) {
    new_portal._DIRECTION = "RIGHT";
  } else if (laser.body.touching.up) {
    new_portal._DIRECTION = "DOWN";
  } else {
    new_portal._DIRECTION = "UP";
  }

  if (laser.body.touching.right || laser.body.touching.left) {
    new_portal.setScale(1, 6).refreshBody();
  } else {
    new_portal.setScale(6, 1).refreshBody();
  }

  if (color == "blue") {
    if (portal_blue) {
      portal_blue.destroy();
    }
    portal_blue = new_portal;
  } else {
    if (portal_yellow) {
      portal_yellow.destroy();
    }
    portal_yellow = new_portal;
  }
  laser.destroy();
  initCollider();
};

const teleportTo = color => (_, item) => {
  var vX, vY, dX, dY;
  const _vX = item.body.velocity.x;
  const _vY = item.body.velocity.y;

  var portalTo = { blue: portal_blue, yellow: portal_yellow }[color];
  var portalFrom = { blue: portal_yellow, yellow: portal_blue }[color];

  if (!portalTo) {
    portalTo = portalFrom;
  }

  dX = { UP: 0, DOWN: 0, LEFT: -32, RIGHT: 32 }[portalTo._DIRECTION];
  dY = { UP: -32, DOWN: 32, LEFT: 0, RIGHT: 0 }[portalTo._DIRECTION];

  var vA = {
    UP: _vY,
    DOWN: -_vY,
    RIGHT: -_vX,
    LEFT: _vX
  }[portalFrom._DIRECTION];

  var vO = {
    UP: _vX,
    DOWN: -_vX,
    RIGHT: -_vY,
    LEFT: _vY
  }[portalFrom._DIRECTION];

  vA = Math.max(120, Math.min(MAX_ROBOT_SPEED, Math.abs(vA)));
  vO = Math.min(MAX_ROBOT_SPEED, vO);

  item.body.x = portalTo.x + dX - 25;
  item.body.y = portalTo.y + dY - 25;

  if (portalTo._DIRECTION == "UP") {
    item.setVelocity(vO, -vA);
  } else if (portalTo._DIRECTION == "DOWN") {
    item.setVelocity(-vO, vA);
  } else if (portalTo._DIRECTION == "RIGHT") {
    item.setVelocity(vA, -vO);
  } else if (portalTo._DIRECTION == "LEFT") {
    item.setVelocity(-vA, vO);
  }
};

const shootLaser = pointer => {
  const level = levels[currentLevel].robot;
  const canShoot = cursors.shift.isDown ? level.hasYellowGun : level.hasBlueGun;
  if (!canShoot) return;

  const laser_group = cursors.shift.isDown ? laser_yellow : laser_blue;
  const laser_image = cursors.shift.isDown ? "portal_yellow" : "portal_blue";

  // Shooting a laser
  var speedX = 2 * pointer.x - robot.x;
  var speedY = 2 * pointer.y - (robot.y + 100);
  var norm = (speedX ** 2 + speedY ** 2) ** 0.5;
  if (norm > 0) {
    var laser = laser_group.create(robot.x, robot.y, laser_image);
    laser.body.allowGravity = false;
    laser.setVelocity(
      (LASER_SPEED * speedX) / norm,
      (LASER_SPEED * speedY) / norm
    );
  }
};

function update(time, delta) {
  gladosBlink.setAlpha(isPaused ? 0 : Math.cos(time / 200));

  const v = robot.body.velocity.x;
  const gSign = that.physics.world.gravity.y < 0 ? 1 : -1;

  const onTheGround =
    (robot.body.touching.down && gSign < 0) ||
    (robot.body.touching.up && gSign > 0);

  if (onTheGround) {
    robot.setVelocityX(0.85 * v);
  } else {
    robot.setVelocityX(1 * v);
  }

  // Moving left and right
  if (cursors.left.isDown) {
    robot.setVelocityX(v < -ROBOT_SPEED ? v : Math.max(-ROBOT_SPEED, v - 50));
  } else if (cursors.right.isDown) {
    robot.setVelocityX(v > ROBOT_SPEED ? v : Math.min(ROBOT_SPEED, v + 50));
  }

  // Jumping
  if (cursors.up.isDown && onTheGround) {
    robot.setVelocityY(gSign * ROBOT_JUMP);
    sound_effect.play();
  }
}
