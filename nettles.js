const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;
const INITIAL_MAX_DEPTH = 5;
const NETTLE_COUNT = 20;
const INITIAL_BRANCH_DISTANCE = 23.5;
const MAX_SIZE_CEILING = 1e3;
const FLOOR_HEIGHT = (HEIGHT * 3) / 5;
const SEED = 52310;
const PERLIN_OFFSET_RATE = 0.001;

let nettles;
let perlinOffset = 0;

function setup() {
  createCanvas(WIDTH, HEIGHT);
  background(0);
  noSmooth();
  nettles = new Nettles(NETTLE_COUNT);
  nettles.init();
}

function draw() {
  perlinOffset += PERLIN_OFFSET_RATE;
  background(0);
  drawFloor();
  randomSeed(SEED);
  nettles.update();
}

function drawFloor() {
  stroke(255);
  line(0, FLOOR_HEIGHT, WIDTH, FLOOR_HEIGHT);
}

function mousePressed() {
  const pressedAt = createVector(mouseX, mouseY);
  const nearestNettle = nettles.findNearestTo(pressedAt);
  if (nearestNettle.plant.plucked === false) {
    nearestNettle.pluck();
  }
}

function guid() {
  function _p8(s) {
    var p = (Math.random().toString(16) + "000000000").substr(2, 8);
    return s ? "-" + p.substr(0, 4) + "-" + p.substr(4, 4) : p;
  }
  return _p8() + _p8(true) + _p8(true) + _p8();
}

class Nettles {
  _nettles;

  constructor(initialAmount) {
    this._nettles = new Array(initialAmount)
      .fill()
      .map(
        (v, i) =>
          new Nettle(
            100 + (random() * WIDTH - 100),
            FLOOR_HEIGHT,
            this,
            i % 3 === 0
          )
      );
  }

  init() {
    this.sortNettlesByZDepth();
    this._nettles.forEach((_nettle) => _nettle.init());
  }

  update() {
    this._nettles.forEach((nettle) => nettle.update());
  }

  deleteNettle(nettle) {
    const index = this._nettles.findIndex((_n) => _n === nettle);
    this._nettles.splice(index, 1);
  }

  plantNettle(parentPosition) {
    const getXPosition = (baseX) => {
      const directionMultiplier = random() * 2 > 1 ? 1 : -1;
      const amount = 10 + random() * 50;
      return baseX + directionMultiplier * amount;
    };

    let newX = getXPosition(parentPosition.x);

    while (newX < 20 || newX > WIDTH - 20) {
      newX = getXPosition(parentPosition.x);
    }

    const newNettle = new Nettle(
      newX,
      FLOOR_HEIGHT,
      this,
      random() * INITIAL_BRANCH_DISTANCE
    );
    newNettle.init();
    this._nettles.push(newNettle);
    this.sortNettlesByZDepth();
  }

  sortNettlesByZDepth() {
    this._nettles.sort((a, b) => (a.zDepth < b.zDepth ? 1 : -1));
  }

  findNearestTo(vector, nettleRef = null) {
    const traversableNettles = this._nettles.filter(
      (n) => n !== nettleRef && !n.plucked
    );
    let nearest = traversableNettles[0];
    let diff = abs(vector.x - nearest.seed.x);
    for (const _nettle of traversableNettles) {
      const newdiff = abs(vector.x - _nettle.seed.x);
      if (newdiff < diff) {
        diff = newdiff;
        nearest = _nettle;
      }
    }
    return nearest;
  }
}

class Nettle {
  guid = guid();
  system;
  seed;
  rootsystem;
  plant;
  size = 0;
  maxSize = random() * MAX_SIZE_CEILING;
  depthValue = INITIAL_MAX_DEPTH;
  zDepth = ceil(random() * 100);
  tween;

  constructor(x, y, parent, sizeOverride, big = false) {
    this.system = parent;
    this.seed = createVector(x, y);
    this.tween = p5.tween.manager.addTween(this, this.guid);

    this.grow(
      sizeOverride ? sizeOverride : random() * this.maxSize * (big ? 3 : 0.5)
    );
  }

  init() {
    this.rootsystem = new Root(this);
    this.plant = new Plant(this);
  }

  update() {
    this.render();
  }

  pluck() {
    this.plant.disappear();
    const nearestNettle = this.system.findNearestTo(this.seed, this);
    nearestNettle.growRhyzome();
  }

  germinate() {
    this.system.plantNettle(this.seed);
  }

  grow(add) {
    const newValue = this.size + add;
    this.tween.addMotion(
      "size",
      newValue,
      (20 + random() * 20) * newValue,
      "easeOutQuad"
    );
    this.tween.startTween();
  }

  growRhyzome() {
    this.grow(300);
    if (Math.random() * 5 > 2) {
      this.system.plantNettle(this.seed);
    }
  }

  render() {
    // render the seed
    fill(255);
    ellipse(this.seed.x, this.seed.y, 4, 4);
    this.rootsystem.render();
    this.plant.render();
  }
}

class Branch {
  lengthMultiplier;
  angle;
  render;
  children;
  depth;

  constructor(depth = 0) {
    this.depth = depth;
    this.lengthMultiplier = (5 + random() * 10) / 25;
    this.angle = radians(10 + random() * 40);
    this.render = true;
    this.children =
      depth < INITIAL_MAX_DEPTH
        ? [new Branch(depth + 1), new Branch(depth + 1)]
        : [];
  }

  addLevel(newDepth) {
    //recurse to find all children
    let childNodes = [this];
    let step = 0;
    while (step < newDepth - 1) {
      childNodes = [...childNodes.flatMap((nodes) => nodes.children)];
      step++;
    }
    let newBranches = [];
    childNodes.forEach((node) => {
      const innerNew = [new Branch(newDepth), new Branch(newDepth)];
      newBranches = [...newBranches, ...innerNew];
      node.children = innerNew;
    });
  }
}

class Root {
  nettle;
  branches = [];
  size;

  constructor(nettle) {
    this.nettle = nettle;
    this.maxDepth = nettle.depthValue;
    this.branches = [new Branch(), new Branch()];
  }

  render() {
    push();
    translate(this.nettle.seed);
    const size = this.nettle.size;
    this.draw(INITIAL_BRANCH_DISTANCE, size);
    if (size > INITIAL_BRANCH_DISTANCE) {
      this.branch(
        this.branches,
        INITIAL_BRANCH_DISTANCE,
        size - INITIAL_BRANCH_DISTANCE
      );
    }
    pop();
  }

  draw(branchdistance, linelength, angle, rotateline = false, depth = 0) {
    stroke(255 - this.nettle.zDepth);
    strokeWeight(this.maxDepth - depth);
    const drawlength = min(linelength, branchdistance);
    if (rotateline) {
      rotate(angle);
    }
    line(0, 0, 0, drawlength);
    translate(0, drawlength);
  }

  branch(branches, branchLength, lengthLeft, depth = 0) {
    branches.forEach((branch, i) => {
      if (branch === undefined || !(branch instanceof Branch)) {
        return;
      }
      const _length = branchLength * branch.lengthMultiplier;
      if (depth < this.maxDepth) {
        if (branch.render) {
          const angle = i === 0 ? branch.angle : -branch.angle;
          push();
          this.draw(
            _length * max(1, depth / 2),
            lengthLeft,
            angle,
            true,
            depth
          );
          if (
            lengthLeft > 3 &&
            lengthLeft > branchLength &&
            branch.children.length
          ) {
            this.branch(
              branch.children,
              branchLength,
              lengthLeft - branchLength,
              depth + 1
            );
          }
          pop();
        }
      }
    });
  }
}

class Plant {
  nettle;
  root;
  tween;
  plucked = false;
  offset = createVector(0, 0);

  constructor(nettle) {
    this.nettle = nettle;
    this.root = nettle.seed;
    this._branches = Array(500)
      .fill()
      .map(() => floor(random() * 6));
    this.tween = p5.tween.manager.addTween(this.offset, guid());
  }
  disappear() {
    this.tween.addMotions(
      [
        {
          key: "x",
          target: -30 + random() * 80,
        },
        {
          key: "y",
          target: -random() * 100,
        },
        {
          key: "z",
          target: -1 + random() * 2,
        },
      ],
      1000,
      "easeInQuad"
    );
    this.tween.startTween();
    setTimeout(() => {
      this.plucked = true;
    }, 1000);
  }
  render() {
    if (!this.plucked) {
      push();
      const plantRoot = p5.Vector.add(this.nettle.seed, this.offset);
      translate(plantRoot);
      rotate(plantRoot.z);
      this.branch(this.nettle.size / 2, 0, 0);
      pop();
    }
  }
  branch(h, xoff, d, index = 0) {
    let sg = map(
      h,
      0,
      this.nettle.size,
      255 - this.nettle.zDepth,
      100 - this.nettle.zDepth
    );
    stroke(color(0, sg, 0));
    let sw = map(h, 2, 100, 1, 5);
    strokeWeight(sw);
    line(0, 0, 0, -h);
    translate(0, -h);
    h *= 0.7;
    xoff += 0.1;
    if (h > 4) {
      let n = this._branches[index];
      for (let i = 0; i < n; i++) {
        index += 1;
        let theta = map(noise(xoff + i, perlinOffset), 0, 1, -PI / 3, PI / 3);
        if (n % 2 == 0) theta *= -1;

        push();
        rotate(theta);
        this.branch(h / 2, xoff, d + 1, index);
        pop();
      }
    }
  }
}
