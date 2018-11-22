var config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1250 }
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
var LASER_SPEED = 3000;

var currentLevel = 0;

var cursors;
var robot;
var blocks;
var killers;
var victory;
var portal_blue;
var laser_blue;
var portal_yellow;
var laser_yellow;

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

  this.load.image("robot", "assets/50x50-pink.png");

  this.load.image("victory", "assets/12x12-green.png");

  this.load.image("portal_blue", "assets/12x12-blue.png");
  this.load.image("portal_yellow", "assets/12x12-yellow.png");
}

function loadLevel(level) {
  if (!level) return;

  // Add the sprite for the robot
  const [rX, rY] = level.robot.position;
  robot = that.physics.add.sprite(rX, rY, "robot");

  // Add blocks to the board
  blocks = that.physics.add.group({
    immovable: true,
    allowGravity: false
  });

  blocks.create(-25, 600, "block_white").setScale(1, 24);
  blocks.create(1625, 600, "block_white").setScale(1, 24);
  blocks.create(800, -25, "block_white").setScale(32, 1);
  blocks.create(800, 1225, "block_white").setScale(32, 1);

  if (level.blocks) {
    level.blocks.forEach(block => {
      const [x, y] = block.position;
      const [sX, sY] = block.scale;
      blocks.create(x, y, "block_black").setScale(sX, sY);
    });
  }

  blocksCollider = that.physics.add.collider(robot, blocks);

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
  that.physics.add.collider(killers, robot, robotDeath);

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
  portal_yellow = null;

  // Physic group for lasers
  laser_blue = that.physics.add.group();
  laser_yellow = that.physics.add.group();
  that.physics.add.collider(laser_blue, blocks, makePortal("blue"));
  that.physics.add.collider(laser_yellow, blocks, makePortal("yellow"));
}

function levelWon() {
  currentLevel = currentLevel + 1;
  pauseWithDialog("You won!", () => that.scene.restart());
}

function create() {
  this.cameras.main.setBounds(0, 0, 1600, 1200);
  this.physics.world.setBounds(0, 0, 1600, 1200);

  // Register the keyboard for receiving inputs
  cursors = this.input.keyboard.createCursorKeys();

  // Starts playing an amazing
  // this.sound.add("space_music", { loop: true }).play();
  sound_effect = this.sound.add("space_sound_effect", { loop: false });

  // Camera :)
  this.cameras.main.setZoom(0.5);

  loadLevel(levels[currentLevel]);
  that.input.on("pointerup", shootLaser);
}

const pauseWithDialog = (dialog, callback) => {
  that.physics.pause();

  graphics = that.add.graphics();
  graphics.fillStyle(0xffff00, 0.2);
  graphics.fillRect(0, 0, 1600, 1200);

  var style = {
    font: "bold 164px Arial",
    fill: "#fff",
    boundsAlignH: "center",
    boundsAlignV: "middle"
  };

  text = that.add.text(800, 600, dialog, style).setOrigin(0.5, 0.5);
  text.setShadow(3, 3, "rgba(0,0,0,0.5)", 2);

  that.input.keyboard.on("keydown", callback);
};

const robotDeath = () => {
  pauseWithDialog("You're dead", () => that.scene.restart());
};

const initCollider = () => {
  if (blocksCollider) blocksCollider.destroy();
  blocksCollider = that.physics.add.collider(robot, blocks);
};

const makePortal = color => (laser, block) => {
  const otherColor = color == "blue" ? "yellow" : "blue";
  var new_portal = that.physics.add.staticImage(
    laser.x,
    laser.y,
    "portal_" + color
  );
  new_portal.alpha = 0.8;
  that.physics.add.overlap(robot, new_portal, teleportTo(otherColor));

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

const teleportTo = color => () => {
  var vX, vY, dX, dY;
  const _vX = robot.body.velocity.x;
  const _vY = robot.body.velocity.y;

  var portalTo = { blue: portal_blue, yellow: portal_yellow }[color];
  var portalFrom = { yellow: portal_blue, blue: portal_yellow }[color];

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

  vA = Math.max(120, Math.min(1500, Math.abs(vA)));
  vO = Math.min(3000, vO);

  robot.body.x = portalTo.x + dX - 25;
  robot.body.y = portalTo.y + dY - 25;

  if (portalTo._DIRECTION == "UP") {
    robot.setVelocity(vO, -vA);
  } else if (portalTo._DIRECTION == "DOWN") {
    robot.setVelocity(-vO, vA);
  } else if (portalTo._DIRECTION == "RIGHT") {
    robot.setVelocity(vA, -vO);
  } else if (portalTo._DIRECTION == "LEFT") {
    robot.setVelocity(-vA, vO);
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
  var speedY = 2 * pointer.y - robot.y;
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

function update() {
  const v = robot.body.velocity.x;
  if (robot.body.touching.down) {
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
  if (cursors.up.isDown && robot.body.touching.down) {
    robot.setVelocityY(-ROBOT_JUMP);
    sound_effect.play();
  }
}
