
Number.prototype.clamp = function(min, max) {
  return Math.min(Math.max(this, min), max);
};


let tileSize=Math.round(800/(102/2*Math.sqrt(3)))
let gridTiles

const createNoise2D=window.createNoise2D 

const app = new PIXI.Application({
    width: document.getElementById('game').clientWidth,
    height: document.getElementById('game').clientHeight,
    backgroundColor: "#1099bb"
});

app.stage.eventMode='static'

window.addEventListener('resize',()=>{
    document.querySelector('#game canvas').width=document.getElementById('game').clientWidth
    document.querySelector('#game canvas').height=document.getElementById('game').clientHeight
})

document.getElementById('game').appendChild(app.view);

let world = new PIXI.Container()
app.stage.addChild(world)
world.eventMode='static'
world.scale.set(Math.max(app.screen.width/(tileSize*Math.sqrt(3)/2*102),2));

app.stage.hitArea = app.screen;

const pointers = new Map();

let lastCenter = null;
let lastDistance = null;

app.stage.on('pointerdown', (e) => {
    pointers.set(e.pointerId, {
        x: e.global.x,
        y: e.global.y
    })
})

function removePointer(e) {
    pointers.delete(e.pointerId)

    lastCenter = null
    lastDistance = null
}

app.stage.on('pointerup', removePointer);
app.stage.on('pointerupoutside', removePointer);
app.stage.on('pointercancel', removePointer);

app.stage.on('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return

    pointers.set(e.pointerId, {
        x: e.global.x,
        y: e.global.y
    });

    const active = [...pointers.values()]

    if (active.length === 1) {
        const p = active[0]

        if (!lastCenter) {
            lastCenter = { ...p }
            return
        }

        world.x += p.x - lastCenter.x
        world.y += p.y - lastCenter.y

        lastCenter = { ...p }
        return
    }

    if (active.length === 2) {
        const p1 = active[0]
        const p2 = active[1]

        const center = {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        }

        const distance = Math.hypot(
            p2.x - p1.x,
            p2.y - p1.y
        )

        if (!lastCenter || !lastDistance) {
            lastCenter = center
            lastDistance = distance
            return
        }

        world.x += center.x - lastCenter.x
        world.y += center.y - lastCenter.y

        const worldBefore = {
            x: (center.x - world.x) / world.scale.x,
            y: (center.y - world.y) / world.scale.y
        }

        let scale = world.scale.x * (distance / lastDistance)
        scale=scale.clamp(Math.max(app.screen.width/(tileSize*Math.sqrt(3)/2*102),2),20)
        world.scale.set(scale)

        const worldAfter = {
            x: (center.x - world.x) / world.scale.x,
            y: (center.y - world.y) / world.scale.y
        }

        world.x += (worldAfter.x - worldBefore.x) * world.scale.x
        world.y += (worldAfter.y - worldBefore.y) * world.scale.y

        lastCenter = center
        lastDistance = distance
    }
});

app.stage.on('wheel', (e) => {
    const mouse = e.global;

    const worldPosBefore = {
        x: (mouse.x - world.x) / world.scale.x,
        y: (mouse.y - world.y) / world.scale.y
    };

    let scale = world.scale.x;
    const zoomSpeed = 0.1;

    scale *= (e.deltaY < 0) ? (1 + zoomSpeed) : (1 - zoomSpeed);
    scale=scale.clamp(Math.max(app.screen.width/(tileSize*Math.sqrt(3)/2*102),2),20)

    world.scale.set(scale);

    const worldPosAfter = {
        x: (mouse.x - world.x) / world.scale.x,
        y: (mouse.y - world.y) / world.scale.y
    };

    world.x += (worldPosAfter.x - worldPosBefore.x) * world.scale.x;
    world.y += ((worldPosAfter.y - worldPosBefore.y) * world.scale.y)

});

let offsetTile=0
// const WORLD_WIDTH = 12000;
app.ticker.add(() => {
    // let o=app.screen.width+tileSize
    // if (world.x < -WORLD_WIDTH+o) world.x += WORLD_WIDTH-o;
    // if (world.x > 0) world.x -= WORLD_WIDTH-o;
    world.y=world.y.clamp(-tileSize*world.scale.x*75+app.screen.height,0)
    world.x=world.x.clamp(-2*tileSize*Math.sqrt(3)/2*102*world.scale.x+app.screen.width,tileSize*Math.sqrt(3)/2*102*world.scale.x)
    
    let offsetWorld=Math.round(world.x/(tileSize*Math.sqrt(3)/2*world.scale.x))
    let lastOffsetTile=offsetTile
    if (world.scale.x > app.screen.width/(tileSize*Math.sqrt(3)/2*101)){
        offsetTile=-offsetWorld-1
    }else{
        offsetTile=-offsetWorld
    }
    
    warpTiles(lastOffsetTile,offsetTile)

    if (app.screen.width-world.x<=0 || world.x<=-tileSize*Math.sqrt(3)/2*102*world.scale.x){
        resetWrap()
    }
});

let map = new PIXI.Container()
world.addChild(map)

let grid = new PIXI.Container()
world.addChild(grid)

let sizeCanvas=800
const canvas = document.getElementById("perlinNoise");
canvas.width=sizeCanvas
canvas.height=sizeCanvas
const ctx = canvas.getContext("2d");
const imageData = ctx.createImageData(sizeCanvas,sizeCanvas);

function setPixel(x, y, color, a = 255) {
    const index = (y * imageData.width + x) * 4;
    imageData.data[index] = color[0];     // R
    imageData.data[index + 1] = color[1]; // G
    imageData.data[index + 2] = color[2]; // B
    imageData.data[index + 3] = a; // A
}

function distanceEucl(c1,c2){
    return Math.sqrt((c2[0]-c1[0])**2+(c2[1]-c1[1])**2)
}

class PerlinNoise{
    constructor(seed,config){
        this.seed=seed
        const rng=new Math.seedrandom(seed+" 1")
        const rng2=new Math.seedrandom(seed+" 2")
        const rng3=new Math.seedrandom(seed+" 3")
        this.n=createNoise2D(rng)
        this.n2=createNoise2D(rng2)
        this.n3=createNoise2D(rng3)
        
        //// Parameters
        const defaults={
            // Main
            scale:0.005,
            octaves:4,
            lacunarity:2,
            persistence:0.5,
            ridged:true,
            inversed:false,

            // Warp
            warp:true,
            warpOctaves:3,
            warpLacunarity:2,
            warpPersistence:0.5,
            warpStrength:0.1,

            //Color
            colorised:true,
            //steps:[0.25,0.30,0.35,0.55,0.70,0.85]
            //steps:[0.20,0.25,0.29,0.5,0.6,0.8]
            steps:[0.14,0.19,0.24,0.35,0.5,0.6],
            centralised:true,
            circleDistance:200
        }

        const cfg = {...defaults,...config}
        this.scale=cfg.scale
        this.octaves=cfg.octaves
        this.lacunarity=cfg.lacunarity
        this.persistence=cfg.persistence
        this.ridged=cfg.ridged
        this.inversed=cfg.inversed
        this.warp=cfg.warp
        this.warpOctaves=cfg.warpOctaves
        this.warpLacunarity=cfg.warpLacunarity
        this.warpPersistence=cfg.warpPersistence
        this.warpStrength=cfg.warpStrength
        this.colorised=cfg.colorised
        this.steps=cfg.steps
        this.centralised=cfg.centralised
        this.circleDistance=cfg.circleDistance
    }
    createPerlinNoise(x1,x2,y1,y2){
        let mapPixels=[]
        this.size=[x2-x1,y2-y1]
        for (let x=Math.max(0,x1);x<Math.min(x2,sizeCanvas);x++){
            let col=new Float32Array(this.size[1])
            for (let y=Math.max(0,y1);y<Math.min(y2,sizeCanvas);y++){
                let coordX=x*this.scale
                let coordY=y*this.scale

                let dx=0
                let dy=0
                let warpAmplitude=1
                let warpFrequency=1
                for (let i=0;i<this.warpOctaves+1;i++){
                    dx+=this.n2(coordX*warpFrequency,coordY*warpFrequency)*warpAmplitude
                    dy+=this.n3(coordX*warpFrequency,coordY*warpFrequency)*warpAmplitude
                
                    warpFrequency *= this.warpLacunarity
                    warpAmplitude *= this.warpPersistence
                }

                if (!this.warp){
                    this.warpStrength=0
                }
                dx*=this.warpStrength
                dy*=this.warpStrength
                
                let s=0
                let d=0
                let amplitude=1
                let frequency=1
                for (let i=0;i<this.octaves+1;i++){
                    let v=this.n(coordX*frequency+dx,coordY*frequency+dy)*amplitude

                    s+=v
                    d+=amplitude
                    frequency *= this.lacunarity
                    amplitude *= this.persistence
                }
                let alphaDistance=1-(distanceEucl([sizeCanvas/2,sizeCanvas/2],[x,y])/(this.circleDistance/(this.scale*100))).clamp(0,1)
                if (!this.centralised){
                    alphaDistance=1
                }
                let value=(s/d)*alphaDistance
                if (this.ridged){
                    value=Math.abs(value)
                }else{
                    value=value*0.5+0.5
                }
                if (this.inversed){
                    value=1-value
                }
                let color
                let ci
                if (this.colorised){
                    if (value < this.steps[0]) {
                        ci=0
                        color = [11, 29, 58]      // deep ocean
                    } else if (value < this.steps[1]) {
                        ci=1
                        color = [18, 63, 107]     // ocean
                    } else if (value < this.steps[2]) {
                        ci=2
                        color = [217, 194, 138]   // sand
                    } else if (value < this.steps[3]) {
                        ci=3
                        color = [79, 139, 58]     // plain
                    } else if (value < this.steps[4]) {
                        ci=4
                        color = [63, 111, 47]     // hills
                    } else if (value < this.steps[5]) {
                        ci=5
                        color = [110, 106, 99]    // mountain
                    } else {
                        ci=6
                        color = [242, 246, 251]  // snow
                    }
                }else{
                    const a=value*255
                    color=[a,a,a]
                }
                setPixel(x,y,color)
                col[y]=ci
            }
            mapPixels.push(col)
        }
        const texture = PIXI.Texture.fromBuffer(
            imageData.data,
            imageData.width,
            imageData.height
        )
        return [mapPixels,texture]
    }
}

let tileTexture = PIXI.Texture.from("data/tileHex.png")
let tileTextureHover = PIXI.Texture.from("data/tileHexHover.png")

function getCoordHex(coord,size){
    return [size*Math.sqrt(3)*(coord[0]/2+(coord[1]%2)/4),size*coord[1]*3/4]
}

class GridTile extends PIXI.Sprite{
    constructor(parentPos,coord,size) {
        super(tileTexture)

        this.origCoord=coord
        this.coord=this.origCoord
        this.size=size
        this.parentPos=parentPos
        this.width=this.size
        this.height=this.size
        
        this.UpdatePosition()

        this.anchor.set(0.5,0.5)
        let pointsHitBox=[]
        let r=276
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2
            pointsHitBox.push(r * Math.cos(angle))
            pointsHitBox.push(r * Math.sin(angle))
        }
        this.hitArea = new PIXI.Polygon(pointsHitBox);

        // Debug draw
        let points=[]
        r=250
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2
            points.push(r * Math.cos(angle))
            points.push(r * Math.sin(angle))
        }
        this.polyBorder = new PIXI.Graphics();
        this.polyBorder.lineStyle(26, 0xff0000, 1);
        this.polyBorder.drawPolygon(points)
        this.polyBorder.alpha=0
        
        this.addChild(this.polyBorder);

        this.debugLabel = new PIXI.Text(`${this.origCoord[0]},${this.origCoord[1]}`,{
                fontSize: 80,
                fill: "#ffffff",
                stroke: "#000000",
                strokeThickness:2
            }
        )

        this.debugLabel.x = -this.debugLabel.width/2
        this.debugLabel.y = -this.debugLabel.height/2

        this.addChild(this.debugLabel)
        this.debugLabel.visible=false
        
        // this.debugLabel = new PIXI.Text(`${this.coord[0]},${this.coord[1]}`,{
        //         fontSize: size/5,
        //         fill: "#ffffff",
        //         stroke: "#000000",
        //         strokeThickness:2
        //     }
        // )

        // this.debugLabel.x = this.x + this.width / 2 - this.debugLabel.width/2
        // this.debugLabel.y = this.y + this.height / 2- this.debugLabel.height/2

        // world.addChild(this.debugLabel)

        this.eventMode='static'

        this.on('pointerover',()=>{
            gsap.to(this.polyBorder, {
                alpha:1,
                duration: 0.1,
                ease: "power2.inOut"
            });
        })

        const pointerOut=()=>{
            gsap.to(this.polyBorder, {
                alpha:0,
                duration: 0.1,
                ease: "power2.inOut"
            });
        }
        this.on('pointerout', pointerOut);
        this.on('pointercancel', pointerOut);

        this.on('click',()=>{
            console.log(this.origCoord)
            this.debugLabel.visible=true
            setTimeout(()=>{
                this.debugLabel.visible=false
            },1000)
        })
    }
    UpdatePosition(){
        let coordHex = getCoordHex(this.coord,this.size)
        this.x=this.parentPos[0]+coordHex[0]
        this.y=this.parentPos[1]+coordHex[1]
    }
}

function warpTiles(l,n){
    let index
    let d=n-l
    if (d<0){
        for (let i=0;i<-d;i++){
            if (l-i<=0){
                index=101+l-i
            }else{
                index=l-i-1
            }
            for (let t in gridTiles[index]){
                let tile=gridTiles[index][t]
                tile.coord=[tile.coord[0]-102,tile.coord[1]]
                tile.UpdatePosition()
            }
        }
    }else if (d>0){
        for (let i=0;i<d;i++){
            if (l+i>=0){
                index=l+i
            }else{
                index=102+l+i
            }
            for (let t in gridTiles[index]){
                let tile=gridTiles[index][t]
                tile.coord=[tile.coord[0]+102,tile.coord[1]]
                tile.UpdatePosition()
            }
        }
    }
}

function resetWrap(){
    let lastOffsetTile=offsetTile
    offsetTile=0
    warpTiles(lastOffsetTile,offsetTile)

    if (lastOffsetTile>0){
        world.x+=tileSize*Math.sqrt(3)/2*102*world.scale.x
    }else{
        world.x-=tileSize*Math.sqrt(3)/2*102*world.scale.x
    }
}

function createGrid(container,coord,size){
    let gridTiles=[]
    for (let x=0;x<size[0];x++){
        let col=[]
        for (let y=0;y<size[1];y++){
            let tile=new GridTile([coord[0]+tileSize/2*Math.sqrt(3)/2,coord[1]+tileSize/2],[x,y],tileSize)
            container.addChild(tile)
            col.push(tile)
        }
        gridTiles.push(col)
    }
    //let seed="1782128928507"
    //let seed="1782128973226" //Snow
    let seed="julie"
    let config={
    //Default
        scale:0.005,
        octaves:4,
        ridged:true,
        inversed:false,
        warp:true,
        colorised:true,
        steps:[0.14,0.19,0.24,0.35,0.5,0.6],
        centralised:true,
        circleDistance:200
    }

    let perlinNoise= new PerlinNoise(seed,config)
    const result=perlinNoise.createPerlinNoise(0,800,0,800)
    const pixels=result[0]
    const mapTexture=result[1]

    let mapSpriteLeft = new PIXI.Sprite(mapTexture)
    map.addChild(mapSpriteLeft)

    mapSpriteLeft.width=800
    mapSpriteLeft.height=800
    mapSpriteLeft.x=-tileSize*Math.sqrt(3)/2*102
    mapSpriteLeft.y=-(800-tileSize*75)/2

    let mapSprite = new PIXI.Sprite(mapTexture)
    map.addChild(mapSprite)

    mapSprite.width=800
    mapSprite.height=800
    mapSprite.x=0
    mapSprite.y=-(800-tileSize*75)/2

    
    let mapSpriteRight = new PIXI.Sprite(mapTexture)
    map.addChild(mapSpriteRight)

    mapSpriteRight.width=800
    mapSpriteRight.height=800
    mapSpriteRight.x=tileSize*Math.sqrt(3)/2*102
    mapSpriteRight.y=-(800-tileSize*75)/2

    return gridTiles
}


gridTiles = createGrid(grid,[0,0],[102,100])


///////// CREATE TEXTURE TILE /////////
// const g = new PIXI.Graphics();
// g.lineStyle(1, "#ffffff", 0.25);
// const r = 200;

// for (let i = 0; i < 6; i++) {
//     const angle = (Math.PI / 3) * i - Math.PI / 2;
//     const x = r * Math.cos(angle);
//     const y = r * Math.sin(angle);
    
//     if (i === 0) g.moveTo(x, y);
//     else g.lineTo(x, y);
// }
// g.closePath();

// const hexTexture = app.renderer.generateTexture(g);

// let sprite = new PIXI.Sprite(hexTexture)
// grid.addChild(sprite)
// sprite.x = 50;
// sprite.y = 50;

// const canvas2 = app.renderer.extract.canvas(sprite);
// const url = canvas2.toDataURL("image/png");

// const a = document.createElement("a");
// a.href = url;
// a.download = "tile.png";
// a.click();


