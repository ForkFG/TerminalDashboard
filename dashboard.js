// :: Info
//    NAME          TerminalDashboard (TDB)
//    AUTHOR        ForkKILLET

// :: Import

// Disable:
// const exec = require('child_process').exec

const
    keypress = require('keypress'),
    tty = require('tty')

// :: Tools

Number.isNumString = s => !isNaN(Number(s))

Error.em = (title, msg) => Error(`\x1B[31m[${title}] ${msg}\x1B[0m`)
Error.unreachable = () => Error.em("???", "It's unreachable! You can never see this f**king error!")

function CP(param, name) {
    return {
        _err(errType, require, exact) {
            throw Error.em("CP", `Param ${name} requires ${errType} ${require}, but got ${exact}.`)
        },
        o: param,
        n: name,
        _npass: false,

        nullable() {
            if (this.o == null) this._npass = true
            return this
        },
        type(ts, soft) { if (this._npass) return this
            const tt = typeof this.o
            if (! Array.isArray(ts)) ts = [ ts ]
            let f = false
            for (let t of ts) {
                f = f || (t === tt)
                if (soft) {
                    if ((tt === "null" || tt === "undefined") && this.o == null) f = true
                    else if (tt === "number" && t === "string") {
                        this.o = this.o.toString(); f = true
                    }
                    else if (tt === "string" && t === "number" && Number.isNumString(this.o)) {
                        this.o = Number(this.o); f = true
                    }
                }
                if (f) break
            }
            return f ? this : this._err("type", `[${ts.join(" ")}]`, `[${typeof p}]`)
        },
        ctype(c) { if (this._npass) return this
            return (this.o instanceof c) ? this : this._err("class", `[${c.name}]`, `[${Object.getPrototypeOf(this.o).constructor.name}]`)
        },

        lt(n, eq) { if (this._npass) return this
            return (this.o < n || eq && this.o == n) ? this : this._err("math range", `p ${eq ? "<=" : "<"} ${n}`, this.o )
        },
        gt(n, eq) { if (this._npass) return this
            return (this.o > n || eq && this.o == n) ? this : this._err("math range", `p ${eq ? ">=" : ">"} ${n}`, this.o) 
        }, 
        ltg(l, r) { if (this._npass) return this
            return (this.o > l && this.o < r) ? this : this._err("range", `${l} < p < ${r}`, this.o)
        },
        pos() { if (this._npass) return this
            return this.gt(0) },
        pos0() { if (this._npass) return this
            return this.gt(0, true) },
        neg() { if (this._npass) return this
            return this.lt(0) },
        neg0() { if (this._npass) return this
            return this.lt(0, true) },

        len(l, r) { if (this._npass) return this
            let n = this.o?.length
            if (n == null) this._err("length", "...", "N/A")
            return r == null
                ? (n === l ? this : this._err("length", `l = ${l}`, n))
                : (n >= l && n <= r ? this : this._err("length", `${l} <= l <= ${r}`))
        },

        eq(n) { // Note: who will use this?
            return (this.o == n) ? this : this._err("range", `p = ${n}`, this.o)
        },
        in(a) {
            return (a.includes(this.o)) ? this : this._err("range in", "\n" + JSON.stringify(a, null, 4) + "\n", this.o)
        }
    }
}


// :: Re[na]der

const
    RC = {
        black:      0,
        red:        1,
        green:      2,
        yellow:     3,
        blue:       4,
        magenta:    5,
        cyan:       6,
        silver:     7,

        _all: [ 1, 2, 3, 4, 5, 6, 7 ]
    },
    RS = {
        plain:      0,
        bold:       1,
        faint:      2,
        italic:     3,
        underline:  4,
        blink:      5,
        // Note: no 6,
        reverse:    7,
        hide:       8,

        _all: [ 1, 2, 3, 4, 5, 7, 8 ]
    };

let R = {
    _pos:   { x: null, y: null },
    pos(x, y) { R._pos.x = x, R._pos.y = y; return R },
    apos(x, y) { R.pos(x, y); return R.apply() },

    _fgc: RC.black,
    fgc(c) { R._fgc = c; return R },
    afgc(c) { R.fgc(c); return R.apply() },

    _bgc: null,
    bgc(c) { R._bgc = c; return R },
    abgc(c) { R.bgc(c); return R.apply() },
    
    _styl: RS.plain,
    styl(b) { R._styl = b; return R },
    astyl(b) { R.styl(b); return R.apply() },

    use(a) {
        if (a) {
            R._pos      = a.pos     ?? R._pos
            R._pos.x    = a.x       ?? R._pos.x
            R._pos.y    = a.y       ?? R._pos.y
            R._fgc      = a.fgc     ?? R._fgc
            R._bgc      = a.bgc     ?? R._bgc
            R._styl     = a.styl    ?? R._styl
        }
        return R
    },

    _esc(p, t) {
        if (! Array.isArray(p)) p = [ p ]
        let f = false, res = ""
        for (let i of p)
            if (i != null) {
                res += (f ? ";" : "\x1B[") + i
                f = true
            }
        return f ? res + t : ""
    },

    apply(a, cb) {
        if (a) R.use(a)
        process.stdout.write(                           // Note:
            R._esc([R._pos.y + 1, R._pos.x + 1], "H") + // Set cursor position (y, x)
            R._esc([
                0,                                      // Clear appearance settings
                R._styl,                                // Set style
                (R._fgc == null ? null : 30 + R._fgc),  // Set foreground color
                (R._bgc == null ? null : 40 + R._bgc)   // Set background color
            ], "m")
        )
        if (typeof cb === "function") cb()
        return R
    },
    atemp(a, cb) {
        let o = {
            x: R._pos.x, y: R._pos.y,
            fgc: R._fgc, bgc: R._bgc,
            styl: R._styl
        }
        R.apply(a)
        cb()
        return R.apply(o)
    },

    reset() {
        process.stdout.write(R._esc(0, "m"))
        return R
    },
    clear() {
        process.stdout.write(R._esc("2", "J"))
        return R
    },
    say(t) {
        process.stdout.write(t)
        return R
    },
    
    read: {
        _rs: [],
        _find(n) {
            for (let i in R.read._rs)
                if (R.read._rs[i]?.name === n) return [ i, R.read._rs[i] ]
            return [ -1, null ]
        },
        add(d, cb) {
            d = CP(d, "R.read.add^d#descriptor").type([ "boolean", "object" ]).o
            R.read._rs.push((ch, info) => {
                if (d === true) cb(ch, info)
                else if (typeof d === "object") {
                    if (! d.hang                    &&

                        ! (d.ctrl ^ info?.ctrl)     &&
                        ! (d.shift ^ info?.shift)   &&
                        ! (d.meta ^ info?.meta)     && // Note: almost useless

                        (! d.key || d.key === ch)             &&
                        (! d.name || d.name === info.name)    &&
                        (! d.seq || d.seq === info.sequence)
                    ) cb(ch, info)
                }
            })
        },
        hang(n) {
            const [, r ] = this._find(n)
            return i == -1 ? false : (r ? (r.hang = true) : false)
        },
        unhang(n) {
            const [, r ] = this._find(n)
            return i == -1 ? false : (r ? (r.hang = false, true) : false)
        },
        rm(n) {
            const [i] = this._find(n)
            return i == -1 ? false : (R.read._rs.splice(i, 1), true)
        }
    },

    go(clearNow, goCb, paleCb) {
        if (clearNow) R.clear()
        
        let i = process.stdin
        keypress(i)
        i.on("keypress", (ch, info) => {
            for (let f of R.read._rs) f(ch, info)
        })
        i.setRawMode(true)
        i.resume()

        R.read.add({
            name: "exit",
            ctrl: true, name: "c"
        }, () => {
            R.pale(true)
            if (typeof paleCb === "function") paleCb()
            process.exit()
        })
        
        if (typeof goCb === "function") goCb()

        return R
    },
    pale(clearNow) { // wWw: be climbed away
        R.reset()
        if (clearNow) R.clear()
        process.stdout.write("\n")
        return R
    },
    sleep(time) {
        return new Promise((resolve) => setTimeout(resolve, time))
    },

    _test() {
        R
        .go()
        .clear()
        .apos(0, 0)
        .say("\n".repeat(10 - 1) + "<C-c> exit")
        .astyl(RS.bold)
        .afgc(RC.red)
        .say("Ice")
        .afgc(RC.blue)
        .say("Lava")
        .atemp(null, () => R
            .afgc(RC.black)
            .say(" in ")
        )
        .say("Terminal")
        .pale()
    }
}

// :: Zone

class TDBZone {
    constructor(root, len, width) {
        this.root   = CP(root, "TDBZone.constructor^root#is root zone").type("boolean").o
        // Note:
        //     l
        //   +--->
        // w |
        //   v   .
        this.len    = CP(len, "TDBZone.constructor^len").type("number", true).pos().o
        this.width  = CP(width, "TDBZone.constructor^length").type("number", true).pos().o
        
        this.pa = null
        this.subz = []
        if (this.root) { this.rx = 0; this.ry = 0 }

        this.bgcD = null
    }

    spot(ch, x, y, Ra) {
        if (! this.pa && ! this.root) throw Error.em("TDBZone.spot", "Unmounted and non-root zone.")

        ch  = CP(ch, "TDBZone:.spot^ch").type("string").len(1).o
        x   = CP(x, "TDBZone:.spot^x").type("number").pos0().lt(this.len).o
        y   = CP(y, "TDBZone:.spot^y").type("number").pos0().lt(this.width).o
        Ra  = CP(Ra, "TDBZone:.spot^Ra#Render attribute").nullable().type("object").o

        const Ra_ = Object.assign({}, Ra, { x: this.rx + x, y: this.ry + y, bgc: this.bgcD })
        R.atemp(Ra_, () => R.say(ch))
        // console.log(Ra_)
    }

    bgcDft(c, fillNow) {
        this.bgcD = CP(c, "TDBZone:.bgcDft^c#color code").type("number").o

        if (fillNow)
            for (let il = 0; il < this.len; il++) // FIXME: it seems go wrong here...
            for (let iw = 0; iw < this.width; iw++)
                this.spot(" ", il, iw, null)
    }

    zone = {
        mnt: (z, x, y) => {
            z = CP(z, "TDBZone:.zone.mnt^z#TDB zone").ctype(TDBZone).o
            x = CP(x, "TDBZone:.zone.mnt^x").type("number").pos0().lt(this.len).o
            y = CP(y, "TDBZone:.zone.mnt^y").type("number").pos0().lt(this.width).o

            z.rx = this.rx + x
            z.ry = this.ry + y
            z.pa = this
            
            this.subz.push(z)
            return this.subz.length - 1
        },
        um: id => {
            // TODO
        }
    }
}

class ZBoard extends TDBZone {
    constructor(width, len, bgc) {
        super(true, width ?? 100, len ?? 25)
        
        bgc = CP(bgc, "ZBoard").in(RC._all).o
        this.bgcDft(bgc, true)
    }
}

class ZBar extends TDBZone {
    constructor(width, minW, overflow) {
        super(false, width, 1)
        // TODO: this.minW       = CP(minW, "ZBar.constructor^minW").type("number", true).pos().o
        this.overflow   = CP(overflow, "ZBar.constructor^overflow#overflow behavior").type("string").in([ "trunc", "...", "error" ]).o
    }
    
    #t = ""
    text(t, Ra) {
        if (t) {
            if (t.length > this.len) {
                switch (this.overflow) {
                    case "trunc":
                        t = t.substring(0, this.len)
                        break
                    case "...":
                        t = (t.substring(0, this.len - 3) + "...").substring(0, this.len)
                        break
                    case "error":
                        throw Error.em("ZBar.text", `Text length: ${t.length}, overflows. Zbar length: ${this.len}`)
                        break
                    default:
                        throw Error.unreachable()
                }
            }
            this.#t = t
            for (let i = 0; i < t.length; i++)
                this.spot(t[i], i, 0, Ra)
        }
        else return this.#t
    }
}

// :: Main

R.go(true, async () => {
    const B = new ZBoard(30, 10, RC.silver)

    R.atemp(null, () => R.apos(0, 9).say("<C-c> exit"))

    
    const barTitle = new ZBar(10, 10, "trunc")
    B.zone.mnt(barTitle, 0, 0)
    
    barTitle.text("Dashboard?", { styl: RS.reverse, fgc: null, bgc: RC.black })
    R.apos(0, 10)

    await R.sleep(2000)

    barTitle.bgcDft(RC.cyan)
    barTitle.text("Dashboard!")
    R.apos(0, 10)
})

