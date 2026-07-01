
Number.prototype.clamp = function(min, max) {
  return Math.min(Math.max(this, min), max);
};


let tileSize=Math.round(800/(102/2*Math.sqrt(3)))
let gridTiles
let selectedTile
let mapSpriteLeft
let mapSprite
let mapSpriteRight
let pixels

let pointsOut=[]
let pointsHitBox=[]
let points=[]
let p
for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2
    pointsHitBox.push(Math.round(276 * Math.cos(angle)))
    pointsHitBox.push(Math.round(276 * Math.sin(angle)))
    points.push(Math.round(250 * Math.cos(angle)))
    points.push(Math.round(250 * Math.sin(angle)))
    pointsOut.push(264.5 * Math.cos(angle))
    pointsOut.push(264.5 * Math.sin(angle))
}

let selectedUnit
let moveTiles=[]

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
let isDrag=false
let isPress=false
let coordPressStart

app.stage.on('pointerdown', (e) => {
    isPress=true
    coordPressStart=[e.global.x,e.global.y]

    pointers.set(e.pointerId, {
        x: e.global.x,
        y: e.global.y
    })
})

function removePointer(e) {
    pointers.delete(e.pointerId)

    lastCenter = null
    lastDistance = null

    isPress=false
}

app.stage.on('pointerup', removePointer);
app.stage.on('pointerupoutside', removePointer);
app.stage.on('pointercancel', removePointer);

app.stage.on('pointermove', (e) => {

    if (coordPressStart && isPress && distanceEucl([e.global.x,e.global.y],coordPressStart)>20){
        isDrag=true
    }

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

let units = new PIXI.Container()
world.addChild(units)

//Moves Border
let maskLeft = new PIXI.Graphics()
maskLeft.beginFill("0000ff")
maskLeft.drawRect(-tileSize*Math.sqrt(3)/2*102, 0, tileSize*Math.sqrt(3)/2*102, 800)
maskLeft.endFill()
world.addChild(maskLeft)

let maskRight = new PIXI.Graphics()
maskRight.beginFill("ff0000")
maskRight.drawRect(tileSize*Math.sqrt(3)/2*102, 0, 800, 800)
maskRight.endFill()
world.addChild(maskRight)

let mask = new PIXI.Graphics()
mask.beginFill("ffffff")
mask.drawRect(0, 0, tileSize*Math.sqrt(3)/2*102, 800)
mask.endFill()
world.addChild(mask)

polyBorderMoves = new PIXI.Graphics()
polyBorderMoves.mask=mask

polyBorderMovesLeft = new PIXI.Graphics(polyBorderMoves.geometry)
polyBorderMovesLeft.mask=maskLeft

polyBorderMovesRight = new PIXI.Graphics(polyBorderMoves.geometry)
polyBorderMovesRight.mask=maskRight

world.addChild(polyBorderMovesLeft)
world.addChild(polyBorderMoves)
world.addChild(polyBorderMovesRight)

//Selected Border
polyBorderSelected = new PIXI.Graphics()
polyBorderSelected.lineStyle(26, 0xffffff, 1, 0.5);
polyBorderSelected.drawPolygon(points)
polyBorderSelected.alpha=0

world.addChild(polyBorderSelected)

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

function DebugTile(){
    const texture = PIXI.Texture.fromBuffer(
        imageData.data,
        imageData.width,
        imageData.height
    )

    mapSpriteLeft.texture=texture
    mapSprite.texture=texture
    mapSpriteRight.texture=texture
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

function getCoordHex(coord,size){
    return [size*Math.sqrt(3)*(coord[0]/2+(coord[1]%2)/4),size*coord[1]*3/4]
}

function getCoordNeighbors(coord){
    let x=coord[0]
    let y=coord[1]
    let even=[[0,-1],[1,0],[0,1],[-1,1],[-1,0],[-1,-1]]
    let odd=[[1,-1],[1,0],[1,1],[0,1],[-1,0],[0,-1]]
    let r
    if (coord[1]%2===0){
        r=even
    }else{
        r=odd
    }
    let ns=[]
    for (let n in r){
        let nx=(r[n][0]+x)%102
        let ny=r[n][1]+y

        if (ny>0 && ny<100){
            if (nx<0) {nx+=102}
            ns.push([nx,ny])
        }
    }
    return ns
}

function getTileFromCoord(coord){
    return gridTiles[coord[0]][coord[1]]
}

function getTypeFromPixels(p){
    n=[0,0,0,0,0,0,0]
    max=0
    for (let i in p){
        n[p[i]]+=1
        if (n[p[i]]>n[max]){
            max=p[i]
        }
    }
    return max
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

        this.UpdatePosition(true)

        this.anchor.set(0.5,0.5)
        this.hitArea = new PIXI.Polygon(pointsHitBox);

        //Debug Border
        // this.polyBorderDebug = new PIXI.Graphics();
        // this.polyBorderDebug.lineStyle(26, 0xff0000, 1);
        // this.polyBorderDebug.drawPolygon(points)
        // this.polyBorderDebug.alpha=0
        // this.addChild(this.polyBorderDebug)

        // this.debugLabel = new PIXI.Text(`${this.origCoord[0]},${this.origCoord[1]}`,{
        //         fontSize: 80,
        //         fill: "#ffffff",
        //         stroke: "#000000",
        //         strokeThickness:2
        //     }
        // )

        // this.debugLabel.x = -this.debugLabel.width/2
        // this.debugLabel.y = -this.debugLabel.height/2

        // this.addChild(this.debugLabel)
        // this.debugLabel.visible=false
        // this.debugLabel.eventMode="none"

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

        // this.on('pointerover',()=>{
        //     gsap.to(this.polyBorderHover, {
        //         alpha:1,
        //         duration: 0.1,
        //         ease: "power2.inOut"
        //     });
        // })

        // const pointerOut=()=>{
        //     gsap.to(this.polyBorderHover, {
        //         alpha:0,
        //         duration: 0.1,
        //         ease: "power2.inOut"
        //     });
        // }
        // this.on('pointerout', pointerOut);
        // this.on('pointercancel', pointerOut);

        this.unitSprite

        this.on('click',()=>{
            if (!isDrag){
                this.Select()

                // this.pixelsTile=[]
                // let ig=["0;0","8;8","0;8","8;0","1;0","7;8","1;8","7;0","0;1","8;7","0;7","8;1"]
                // for (let x=0;x<9;x++){
                //     for (let y=0;y<9;y++){
                //         if (!ig.includes(`${x};${y}`)){
                //             setPixel((Math.floor(this.origCoordHex[0])+x)%795,Math.floor(this.origCoordHex[1])+y+Math.round((800-tileSize*75)/2),[255,255,0])
                //             let gridX=(Math.floor(this.origCoordHex[0])+x)%795
                //             let gridY=Math.floor(this.origCoordHex[1])+y+Math.round((800-tileSize*75)/2)
                //             this.pixelsTile.push(pixels[gridX][gridY])
                //         }
                //     }
                // }
                // DebugTile()

                let type=['deep ocean','ocean','sand','plain','hills','mountain','snow']
                console.log(this.origCoord,type[this.typeIndex])
            }else{
                isDrag=false
            }
        })
    }
    UpdatePosition(f=false){
        this.origCoordHex=getCoordHex(this.origCoord,this.size)

        let coordHex = getCoordHex(this.coord,this.size)
        this.coordHex=coordHex
        this.x=this.parentPos[0]+coordHex[0]
        this.y=this.parentPos[1]+coordHex[1]

        if (this.unitSprite){
            this.unitSprite.x=this.x
            this.unitSprite.y=this.y
        }

        if (f){
            this.typeIndex=0
            this.pixelsTile=[]
            let ig=["0;0","8;8","0;8","8;0","1;0","7;8","1;8","7;0","0;1","8;7","0;7","8;1"]
            for (let x=0;x<9;x++){
                for (let y=0;y<9;y++){
                    if (!ig.includes(`${x};${y}`)){
                        let gridX=(Math.floor(this.origCoordHex[0])+x)%795
                        let gridY=Math.floor(this.origCoordHex[1])+y+Math.round((800-tileSize*75)/2)
                        this.pixelsTile.push(pixels[gridX][gridY])
                    }
                }
            }
            this.typeIndex=getTypeFromPixels(this.pixelsTile)
        }
    }
    Select(){
        //Case
        if (selectedTile && selectedTile!==this) selectedTile.UnSelect()
        selectedTile=this

        polyBorderSelected.position.copyFrom(this.position)
        polyBorderSelected.scale.copyFrom(this.scale)
        polyBorderSelected.alpha=1

        //Unité
        console.log(isInList(this.origCoord,moveTiles))
        if (isInList(this.origCoord,moveTiles)){
            selectedUnit.moveTo(this.origCoord)
            polyBorderMoves.clear()
        }else{
            selectedUnit=null
            moveTiles=[]

            if (this.unitSprite){
                selectedUnit=this.unitSprite
                moveTiles=this.unitSprite.getMovesTiles()
                this.updateBorderMoveArea(this.origCoord,moveTiles)
            }else{
                polyBorderMoves.clear()
            }
        }

        
    }
    UnSelect(){
        polyBorderSelected.alpha=0
    }
    addUnit(u){
        this.unitSprite=u
        this.UpdatePosition()
        this.unitSprite.tileCoord=this.origCoord
    }
    removeUnit(u){
        this.unitSprite=null
    }
    updateBorderMoveArea(o,group){
        
        let newGroup=[]
        for (let g of group){
            newGroup.push(g)
            if (g[0]===0){
                newGroup.push([102,g[1]])
            }else if (g[0]===101){
                newGroup.push([-1,g[1]])
            }
        }

        polyBorderMoves.clear()
        polyBorderMoves.lineStyle(26, "#19d1f1", 1, 1)

        let allPoints=[]

        //Add points of the origin hexagon
        let psO=[]
        for (let p=0;p<pointsOut.length;p+=2){
            psO.push([pointsOut[p],pointsOut[p+1],o])
        }
        allPoints.push(psO)

        for (let g=0;g<newGroup.length;g++){
            //Get center of the Hexagon
            let cg=getCenterTranslation(o,newGroup[g])
            let ps=[]

            //Get all points
            for (let p=0;p<pointsOut.length;p+=2){
                let x=cg[0]+pointsOut[p]
                let y=cg[1]+pointsOut[p+1]

                //Merge by distance
                for (let i=0;i<g+1;i++){
                    for (let q=0;q<6;q++){
                        if (Math.round(Math.abs(allPoints[i][q][0]-x))<3 && Math.round(Math.abs(allPoints[i][q][1]-y))<3){
                            x=allPoints[i][q][0]
                            y=allPoints[i][q][1]
                        }
                    }
                }

                //Add Point
                ps.push([x,y])
            }

            //Add hexagon points
            allPoints.push(ps)
        }

        let allEdges={}
        for (let g in allPoints){
            for (let e=0;e<6;e++){
                let nedge=normalizeEdge(allPoints[g][e],allPoints[g][(e+1)%6])
                let edge=formatEdge(allPoints[g][e],allPoints[g][(e+1)%6])

                if (allEdges[nedge]){
                    delete allEdges[nedge]
                }else{
                    allEdges[nedge]=edge
                }
            }
        }

        let dedge={}
        for (let d in allEdges){
            dedge[allEdges[d][0]]=allEdges[d][1]
        }

        let start=Object.keys(dedge)[0]
        polyBorderMoves.moveTo(Number(start.split(';')[0]),Number(start.split(';')[1]))
        let current=null
        while (Object.keys(dedge).length!==0){
            if (current===null){
                current = dedge[start]
                delete dedge[start]
            }else{
                let newCurrent = dedge[current]
                //If cycle not finish
                if (dedge[current]){
                    delete dedge[current]
                    current = newCurrent
                }else{
                    //Move to new cycle
                    polyBorderMoves.closePath()
                    start=Object.keys(dedge)[0]
                    polyBorderMoves.moveTo(Number(start.split(';')[0]),Number(start.split(';')[1]))

                    current = dedge[start]
                    delete dedge[start]
                }
            }
            
            polyBorderMoves.lineTo(Number(current.split(';')[0]),Number(current.split(';')[1]))
        }

        polyBorderMoves.closePath()

        polyBorderMoves.x=this.parentPos[0]+this.origCoordHex[0]
        polyBorderMoves.y=this.parentPos[1]+this.origCoordHex[1]
        polyBorderMoves.scale.copyFrom(this.scale)

        polyBorderMovesLeft.x=polyBorderMoves.x-tileSize*Math.sqrt(3)/2*102
        polyBorderMovesLeft.y=polyBorderMoves.y
        polyBorderMovesLeft.scale.copyFrom(this.scale)

        polyBorderMovesRight.x=polyBorderMoves.x+tileSize*Math.sqrt(3)/2*102
        polyBorderMovesRight.y=polyBorderMoves.y
        polyBorderMovesRight.scale.copyFrom(this.scale)

    }
}

function normalizeEdge(a, b) {
    let ax=a[0]
    let ay=a[1]
    let bx=b[0]
    let by=b[1]
    return ax < bx || (ax === bx && ay < by) ? `${ax},${ay}|${bx},${by}` : `${bx},${by}|${ax},${ay}`;
}

function formatEdge(a, b) {
    return [`${a[0]};${a[1]}`,`${b[0]};${b[1]}`]
}

function getCenterTranslation(o,g){
    let c=[]
    let dx=(g[0]-o[0])
    let dy=g[1]-o[1]

    let h=264.5*Math.sqrt(3)
    let s=h*dx
    if (dy%2!==0){
        dx=dx*2+1
        if (o[1]%2==0){
            s=h/2*dx
        }else{
            s=h/2*(dx-2)
        }
    }
    return [s,264.5*3/2*dy]
}

function isInList(a,b){
    for (let c in b){
        if (a[0]===b[c][0] && a[1]===b[c][1]){
            return true
        }
    }
    return false
}

function isEqual(a,b){
    return a[0]===b[0] && a[1]===b[1]
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
    pixels=result[0]
    const mapTexture=result[1]

    mapSpriteLeft = new PIXI.Sprite(mapTexture)
    map.addChild(mapSpriteLeft)

    mapSpriteLeft.width=800
    mapSpriteLeft.height=800
    mapSpriteLeft.x=-tileSize*Math.sqrt(3)/2*102
    mapSpriteLeft.y=-(800-tileSize*75)/2

    mapSprite = new PIXI.Sprite(mapTexture)
    map.addChild(mapSprite)

    mapSprite.width=800
    mapSprite.height=800
    mapSprite.x=0
    mapSprite.y=-(800-tileSize*75)/2


    mapSpriteRight = new PIXI.Sprite(mapTexture)
    map.addChild(mapSpriteRight)

    mapSpriteRight.width=800
    mapSpriteRight.height=800
    mapSpriteRight.x=tileSize*Math.sqrt(3)/2*102
    mapSpriteRight.y=-(800-tileSize*75)/2

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


class Unit extends PIXI.Sprite{
    constructor(typeIndex){
        super(unitsTexture[typeIndex])

        this.width=7
        this.height=7
        this.anchor.set(0.5,0.5)
        this.tileCoord=[-1,-1]

        this.eventMode='none'
    }
    getMovesTiles(){
        
        return getCoordNeighbors(this.tileCoord)

        let m=[]
        for (let i=0;i<102;i++){
            if (i!==this.tileCoord[0]) m.push([i,this.tileCoord[1]])
        }
        return m
    }
    moveTo(c){
        getTileFromCoord(this.tileCoord).removeUnit()
        getTileFromCoord(c).addUnit(this)
    }
}

let unitType = ["Éclaireur","Bâtisseur","Guerrier"]
let unitsTexture = [PIXI.Texture.from("data/start.png")]
let u = new Unit(0)
units.addChild(u)

getTileFromCoord([49,34]).addUnit(u)