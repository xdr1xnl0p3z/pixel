import m from 'mithril'
import ImageSelector from '../components/image_selector'
import {short_description} from '../components/description'
import {COLORS, PIXEL_WIDTH, LOUPE_VIEW_PAD, PIXEL_DENSITY, MOBILE_MAX_WIDTH, TABLET_MAX_WIDTH} from '../constants'
import {capitalize, closestRect, normalizeRect, setCanvasSize, getMouseCoords} from '../helpers'

function drawGame (vnode, canvas, isLoupe, dx = 0, dy = 0) {
  let game = vnode.attrs.game
  let ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, 500 * PIXEL_DENSITY, 500 * PIXEL_DENSITY)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 500 * PIXEL_DENSITY, 500 * PIXEL_DENSITY)
  let pixelMult = isLoupe ? 600 / (LOUPE_VIEW_PAD * 2 + 1) : PIXEL_DENSITY
  dx *= pixelMult
  dy *= pixelMult
  if (isLoupe) {
    dx -= LOUPE_VIEW_PAD * pixelMult
    dy -= LOUPE_VIEW_PAD * pixelMult
  }
  if (vnode.state.imgCanvas && vnode.state.revealImage) {
    ctx.drawImage(
      vnode.state.imgCanvas,
      0 - dx, 0 - dy, pixelMult * vnode.state.imgCanvas.width, pixelMult * vnode.state.imgCanvas.height)
    if (!isLoupe) {
      if (!isLoupe && vnode.state.mouseIsOver) {
        // fade background image if mouse is over image
        ctx.lineWidth = 0
        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        ctx.fillRect(0, 0, vnode.state.canvas.width, vnode.state.canvas.height)
      }
    }
  }

  // Draw rectangles
  function drawRect (player, x, y, w, h, id) {
    ctx.lineWidth = isLoupe ? 8 : 4
    if (!isLoupe && id === vnode.state.closestRect && vnode.state.tool === 'erase' && player === vnode.attrs.game.role) {
      ctx.strokeStyle = COLORS.SELECTION
    } else {
      ctx.strokeStyle = player == 'red' ? COLORS.RED : COLORS.BLUE
    }
    ctx.strokeRect((x + 0.5) * pixelMult - dx, (y + 0.5) * pixelMult - dy, w * pixelMult, h * pixelMult)
  }
  for (let [id,{player, x, y, w, h}] of Object.entries(game.rectangles())) {
    drawRect(player, x, y, w, h, id)
  }
  if (vnode.state.currentRect) {
    let {x, y, w, h} = normalizeRect(vnode.state.currentRect)
    drawRect(vnode.attrs.game.role, x, y, w, h, -1)
  }

  // Draw pixels
  if (vnode.state.imgCanvas) {
    const drawnPixelWidth = isLoupe ? 1 : PIXEL_WIDTH
    ctx.lineWidth = isLoupe ? 5 : 3
    for (let {player, x, y} of game.pixels()) {
      ctx.strokeStyle = player == 'red' ? COLORS.RED_FULL : COLORS.BLUE_FULL
      ctx.fillStyle = pixelColor(vnode, {x, y})
      ctx.beginPath()
      ctx.rect((x - drawnPixelWidth / 2 + 0.5) * pixelMult - dx,
        (y - drawnPixelWidth / 2 + 0.5) * pixelMult - dy,
        drawnPixelWidth * pixelMult,
        drawnPixelWidth * pixelMult)
      ctx.fill()
      ctx.stroke()
    }
  }

  if (vnode.state.touchMode && !isLoupe) {
    ctx.lineWidth = 2
    let p = vnode.state.mousePos
    ctx.strokeStyle = '#fff'
    ctx.strokeRect((p.x - LOUPE_VIEW_PAD) * PIXEL_DENSITY,
      (p.y - LOUPE_VIEW_PAD) * PIXEL_DENSITY,
      (LOUPE_VIEW_PAD * 2 + 1) * PIXEL_DENSITY,
      (LOUPE_VIEW_PAD * 2 + 1) * PIXEL_DENSITY)
    ctx.strokeStyle = '#666'
    ctx.strokeRect((p.x - LOUPE_VIEW_PAD) * PIXEL_DENSITY + 1,
      (p.y - LOUPE_VIEW_PAD) * PIXEL_DENSITY + 1,
      (LOUPE_VIEW_PAD * 2 + 1) * PIXEL_DENSITY,
      (LOUPE_VIEW_PAD * 2 + 1) * PIXEL_DENSITY)
  }
}

function updateLoupe (vnode) {
  let loupeCanvas = document.getElementById('loupe')
  let loupeCtx = loupeCanvas.getContext('2d')
  loupeCtx.imageSmoothingEnabled = false
  loupeCtx.clearRect(0, 0, 600, 600)
  if (vnode.state.touchMode || vnode.state.mouseIsOver) {
    let x = Math.round(vnode.state.mousePos.x)
    let y = Math.round(vnode.state.mousePos.y)
    drawGame(vnode, loupeCanvas, true, x, y)
  } else {
    loupeCtx.fillStyle = '#fff'
    loupeCtx.fillRect(0, 0, 600, 600)
  }
  loupeCtx.setLineDash([12, 12.5])
  loupeCtx.lineWidth = 2
  loupeCtx.strokeStyle = 'rgba(0,0,0,0.3)'
  loupeCtx.beginPath()
  loupeCtx.moveTo(0, 301)
  loupeCtx.lineTo(600, 301)
  loupeCtx.moveTo(301, 0)
  loupeCtx.lineTo(301, 600)
  loupeCtx.stroke()
  loupeCtx.beginPath()
  loupeCtx.moveTo(0, 299)
  loupeCtx.lineTo(600, 299)
  loupeCtx.moveTo(299, 0)
  loupeCtx.lineTo(299, 600)
  loupeCtx.stroke()
  loupeCtx.strokeStyle = '#C5C5D2'
  loupeCtx.beginPath()
  loupeCtx.moveTo(0, 300)
  loupeCtx.lineTo(600, 300)
  loupeCtx.moveTo(300, 0)
  loupeCtx.lineTo(300, 600)
  loupeCtx.stroke()
  loupeCtx.setLineDash([])
}

function updateCanvasSize (vnode) {
  if (vnode.state.imgSize) {
    let {width, height} = vnode.state.imgSize
    setCanvasSize(vnode.state.canvas, width, height)
  } else {
    setCanvasSize(vnode.state.canvas, 500, 500)
  }
}

function updateImage (vnode) {
  if (vnode.attrs.game.imageUrl() !== vnode.state.lastImageUrl) {
    vnode.state.lastImageUrl = vnode.attrs.game.imageUrl()
    if (vnode.attrs.game.hasImage()) {
      let thisImageUrl = vnode.attrs.game.imageUrl()
      vnode.attrs.game.image().then(imgCanvas => {
        if (vnode.state.lastImageUrl === thisImageUrl) { // ensure it hasn't been changed again in the meantime
          vnode.state.imgCanvas = imgCanvas
          let {width, height} = imgCanvas
          vnode.state.imgSize = {width, height}
          updateCanvasSize(vnode)
          m.redraw()
        }
      })
    } else {
      vnode.state.imgCanvas = null
    }
  }
  updateCanvasSize(vnode)
}

function pixelColor (vnode, pos) {
  let pixelData = vnode.state.imgCanvas.getContext('2d').getImageData(pos.x, pos.y, 1, 1).data
  return `rgba(${pixelData.join(',')})`
}

function updateCanvas (vnode) {
  drawGame(vnode, vnode.state.canvas, false)
  updateLoupe(vnode)
}

function setMousePos (vnode, x, y) {
  x = Math.min(Math.max(0, x), vnode.state.canvas.width / PIXEL_DENSITY - 1)
  y = Math.min(Math.max(0, y), vnode.state.canvas.height / PIXEL_DENSITY - 1)
  vnode.state.mousePos = {x, y}
  if (vnode.attrs.game.role !== 'judge') {
    vnode.state.closestRect = closestRect(vnode.attrs.game.rectangles(vnode.attrs.game.role), x, y)
  } else {
    vnode.state.closestRect = null
  }
  if (vnode.state.currentRect) {
    vnode.state.currentRect.x2 = x
    vnode.state.currentRect.y2 = y
  }
}

function startRect (vnode) {
  let {x, y} = vnode.state.mousePos
  vnode.state.currentRect = {x1: x, y1: y, x2: x, y2: y}
}

function endRect (vnode) {
  if (vnode.state.currentRect !== null) {
    let {x, y, w, h} = normalizeRect(vnode.state.currentRect)
    vnode.attrs.game.addRectangle(x, y, w, h)
    vnode.state.currentRect = null
  }
}

function makePixel (vnode) {
  let {x, y} = vnode.state.mousePos
  vnode.attrs.game.addPixel(Math.round(x), Math.round(y))
}

function eraseClosestRect (vnode) {
  if (vnode.state.closestRect) {
    vnode.attrs.game.removeRectangle(vnode.state.closestRect)
    vnode.state.closestRect = null
  }
}

function initCanvas (vnode) {
  vnode.state.canvas = document.getElementById('play')
  vnode.state.loupe = document.getElementById('loupe')
  setCanvasSize(vnode.state.canvas, 500, 500)
  vnode.state.canvas.onmousedown = event => {
    vnode.state.touchMode = false
    if (vnode.attrs.game.role === 'judge' || !vnode.attrs.game.hasImage()) {
      return
    }
    if (vnode.state.tool === 'erase') {
      eraseClosestRect(vnode)
    } else if (vnode.state.tool === 'pixel') {
      makePixel(vnode)
    } else if (vnode.state.tool === 'rect') {
      startRect(vnode)
    }
    m.redraw()
  }
  vnode.state.canvas.onmouseup = event => {
    vnode.state.touchMode = false
    if (vnode.state.tool === 'rect') {
      endRect(vnode)
      m.redraw()
    }
  }
  vnode.state.canvas.onmousemove = event => {
    vnode.state.touchMode = false
    vnode.state.mouseIsOver = true
    let {x, y} = getMouseCoords(vnode.state.canvas, event)
    setMousePos(vnode, x, y)
    m.redraw()
  }
  vnode.state.canvas.onmouseover = () => {
    vnode.state.touchMode = false
    vnode.state.mouseIsOver = true
    m.redraw()
  }
  vnode.state.canvas.onmouseout = () => {
    vnode.state.touchMode = false
    vnode.state.mouseIsOver = false
    vnode.state.closestRect = null
    m.redraw()
  }
  let ontouch = (e) => {
    if (vnode.attrs.game.role !== 'judge' && !vnode.attrs.game.hasImage()) {
      // the set image button has appeared
      return
    }
    e.preventDefault()
    vnode.state.touchMode = true
    vnode.state.mouseIsOver = false
    let {x, y} = getMouseCoords(vnode.state.canvas, e)
    setMousePos(vnode, x, y)
    m.redraw()
  }
  vnode.state.canvas.ontouchstart = ontouch
  vnode.state.canvas.ontouchmove = ontouch
  vnode.state.loupe.ontouchstart = (e) => {
    vnode.state.touchMode = true
    e.preventDefault()
    vnode.state.lastTouchPosition = getMouseCoords(vnode.state.loupe, e)
  }
  vnode.state.loupe.ontouchmove = (e) => {
    let {x, y} = getMouseCoords(vnode.state.loupe, e)
    let pixelMult = 250 / (LOUPE_VIEW_PAD * 2 + 1)
    setMousePos(vnode,
      vnode.state.mousePos.x - (x - vnode.state.lastTouchPosition.x) / pixelMult,
      vnode.state.mousePos.y - (y - vnode.state.lastTouchPosition.y) / pixelMult)
    vnode.state.lastTouchPosition = {x, y}
    m.redraw()
  }
  vnode.state.loupe.ontouchend = (e) => {
    vnode.state.lastTouchPosition = null
  }
}

export default {
  oninit: (vnode) => {
    let reset = () => {
      vnode.state.tool = 'rect' // either 'rect', 'pixel', 'erase'
      vnode.state.revealImage = vnode.attrs.game.role !== 'judge'
      vnode.state.mousePos = {x: 0, y: 0}
      vnode.state.lastImageUrl = ''
      vnode.state.imgCanvas = null
      vnode.state.currentRect = null
      vnode.state.rectEnd = null
      vnode.state.closestRect = null
      vnode.state.lastTouchPosition = null
      vnode.state.mouseIsOver = false
      vnode.state.imageSelectorVisible = false
      vnode.state.touchMode = false
      vnode.state.showToolsMobile = false
    }
    reset()
    vnode.attrs.game.onReset(reset)
    vnode.attrs.game.onReset(m.redraw)
  },
  oncreate: (vnode) => {
    window.onresize = m.redraw
    initCanvas(vnode)
    vnode.state.canvas.setup = true
    updateImage(vnode)
    updateCanvas(vnode)
    updateLoupe(vnode)
  },
  onupdate: (vnode) => {
    if (!document.getElementById('play').setup) {
      initCanvas(vnode)
      vnode.state.canvas.setup = true
    }
    updateImage(vnode)
    updateCanvas(vnode)
    updateLoupe(vnode)
  },
  view: (vnode) => {
    let pageWidth = window.screen.width
    const stateButton = (type, name, label, disable = false, customClass = '') => {
      return m('button', {
        class: customClass + (vnode.state[type] === name ? ' selected' : ''),
        disabled: disable,
        onclick: () => {
          vnode.state[type] = name
        }
      }, label)
    }

    let toolbar = []
    if (vnode.state.revealImage) {
      toolbar.push(
        m('div', {style: 'flex-shrink: 0;'}, stateButton('revealImage', false, 'Hide Image', !vnode.attrs.game.hasImage()))
      )
      if (vnode.attrs.game.attribution()) {
        toolbar.push(m('a.hint', {href: vnode.attrs.game.attribution().url}, vnode.attrs.game.attribution().text))
      }
    } else {
      toolbar.push(m('div', {style: 'flex-shrink: 0;'}, stateButton('revealImage', true, 'Reveal Image', !vnode.attrs.game.hasImage())))
    }
    toolbar = m('.row.gap-2.middle.left', toolbar)
    let rectCoordsView = null
    if (vnode.state.mouseIsOver || vnode.state.touchMode) {
      if (vnode.state.currentRect) {
        let {x1, y1, x2, y2} = vnode.state.currentRect
        rectCoordsView = m('.hint.row.left', [
          m('.coord', {style: 'width:50px;'}, `x1: ${Math.round(x1)}`),
          m('.coord', {style: 'width:50px;'}, `y1: ${Math.round(y1)}`),
          m('.coord', {style: 'width:50px;'}, `x2: ${Math.round(x2)}`),
          m('.coord', {style: 'width:50px;'}, `y2: ${Math.round(y2)}`)
        ])
      } else {
        let {x, y} = vnode.state.mousePos
        rectCoordsView = m('.hint.row.left', [
          m('.coord', {style: 'width:50px;'}, `x: ${Math.round(x)}`),
          m('.coord', {style: 'width:50px;'}, `y: ${Math.round(y)}`)
        ])
      }
    }

    let [coinResult, coinHash] = vnode.attrs.game.coinflipResult()

    let roleSection = []
    if (vnode.attrs.game.role === 'judge') {
      roleSection.push(m('.role-judge', 'Judge'))
      if (vnode.attrs.game.isFull()) {
        roleSection.push(m('.hint', {disabled: true}, 'Looks like this game already has two debaters.'))
      } else {
        roleSection.push(m('button', {onclick: () => {
          vnode.attrs.game.becomeDebater().then(color => {
            if (color) {
              vnode.state.revealImage = true
            }
          })
        }}, 'Become a Debater'))
      }
    } else {
      let roleName = capitalize(vnode.attrs.game.role)
      roleSection.push(m(`.role-${vnode.attrs.game.role}`, `${roleName} Player`))
      if (pageWidth > MOBILE_MAX_WIDTH) {
        if (vnode.state.touchMode && vnode.state.currentRect) {
          roleSection = roleSection.concat([
            m('button', {onclick: () => {
              endRect(vnode)
            }}, 'End Rectangle'),
            m('button', {onclick: () => {
              vnode.state.currentRect = null
            }}, 'Cancel Rectangle')
          ])
        } else if (vnode.state.touchMode) {
          roleSection = roleSection.concat([
            m('button', {onclick: () => {
              startRect(vnode)
            }}, 'Start Rectangle'),
            m('button', {onclick: () => {
              makePixel(vnode)
            }}, 'Reveal Pixel'),
            m('button', {disabled: !vnode.state.closestRect,
              onclick: () => {
                eraseClosestRect(vnode)
              }}, 'Erase')
          ])
        } else {
          roleSection = roleSection.concat([
            stateButton('tool', 'rect', 'Rectangle Tool'),
            stateButton('tool', 'pixel', 'Pixel Reveal Tool'),
            stateButton('tool', 'erase', 'Eraser')
          ])
        }
      }
    }
    let imageSelectorButton = null
    if (!vnode.attrs.game.hasImage() && vnode.attrs.game.role !== 'judge') {
      imageSelectorButton = m('button.canvas-button', {onclick: () => { vnode.state.imageSelectorVisible = true }}, 'Select Image...')
    }
    let loupe = m('canvas#loupe', {width: 600, height: 600, style: `width: 100%;`})
    let tools = m('.col.gap-3', [
      m('.col.gap-1.justify', [
        m('h2', 'Game Link'),
        m('a', {href: `/game/${vnode.attrs.game.code}`, 'class': 'game-link'}, `/game/${vnode.attrs.game.code}`),
        m('p.hint', 'Copy, paste, and send link to invite others to join this game.')
      ]),
      m('hr'),
      m('.col.gap-1.justify', [
        m('h2', 'Current Role'),
        roleSection
      ]),
      vnode.attrs.game.role === 'judge' ? null : [
        m('hr'),
        m('.col.gap-1.justify', [
          m('h2', 'Coin Flip'),
          m('span.coinResults', {
            oncreate: (vnode) => { vnode.state.coinHash = coinHash },
            onupdate: (vnode) => {
              if (vnode.state.coinHash !== coinHash) {
                vnode.state.coinHash = coinHash
                vnode.dom.style.animation = 'none'
                vnode.dom.getBoundingClientRect() // reflow
                vnode.dom.style.animation = null
              }
            }
          }, coinResult ? 'Heads' : 'Tails'),
          m('button', {onclick: () => {
            vnode.attrs.game.coinflip()
          }}, 'Flip Coin'),
          m('p.hint', 'Only debaters can see the result of coin flips.')
        ])
      ],
      m('hr'),
      m('button', {onclick: () => {
        vnode.attrs.game.reset()
      }}, 'Reset Board & Roles')
    ])
    let play = m('canvas#play', {style: 'cursor: crosshair;'})
    if (pageWidth > MOBILE_MAX_WIDTH) {
      return m('div', [
        m('.col.gap-4.justify', [
          [short_description(true), m('hr')],
          m('.row.gap-4', [
            m('.tools-desktop', [tools]),
            m(pageWidth > TABLET_MAX_WIDTH ? '.row.gap-4' : '.col.gap-2.center', [
              m('.col.gap-2', [
                m('.col', [
                  m('.play-wrap-desktop.center.middle', [
                    play,
                    imageSelectorButton
                  ])
                ]),
                toolbar
              ]),
              m('.col.gap-3', [
                m('h2', 'Zoom'),
                m('.loupe-wrap-desktop', [
                  loupe
                ]),
                rectCoordsView
              ])
            ])
          ]),
          vnode.attrs.game.connected ? null : m('div', 'Disconnected! Trying to reconnect...')
        ]),
        vnode.state.imageSelectorVisible
          ? m(ImageSelector, {game: vnode.attrs.game, close: () => { vnode.state.imageSelectorVisible = false }})
          : null
      ])
    } else {
      let mobileTools
      if (vnode.state.showToolsMobile) {
        mobileTools = [
          m('button', {onclick: () => {vnode.state.showToolsMobile = false}}, 'Back to Game'),
          tools,
          m('hr'),
          toolbar
        ]
      } else if (vnode.attrs.game.role === 'judge') {
        mobileTools = [m('button', {onclick: () => {vnode.state.showToolsMobile = true}}, 'More')]
      } else if (vnode.state.currentRect) {
        mobileTools = m('.col.gap-2', [
          m('.row.gap-2', [
            m('button', {onclick: () => endRect(vnode)}, 'End Rect'),
            m('button', {onclick: () => {vnode.state.currentRect = null}}, 'Cancel Rect'),
          ]),
        ])
      } else {
        mobileTools = m('.col.gap-2', [
          m('.row.gap-2', [
            m('button.fill', {onclick: () => startRect(vnode)}, 'Start Rect'),
            m('button.fill', {onclick: () => makePixel(vnode)}, 'Show Pixel'),
            m('button.fill', {disabled: !vnode.state.closestRect,
              onclick: () => {
                eraseClosestRect(vnode)
              }}, 'Erase'),
            m('button.fill', {onclick: () => {vnode.state.showToolsMobile = true}}, 'More'),
          ]),
        ])
      }
      let shouldHide = vnode.state.showToolsMobile ? 'display: none' : ''
      return m('div', [
        m('.col.gap-2.justify.game-wrap-mobile', [
          mobileTools,
          m('.play-wrap-mobile.center.middle', {style: shouldHide}, [
            play,
            imageSelectorButton
          ]),
          m('.loupe-wrap-mobile.fill.middle', {style: shouldHide}, [
            loupe
          ])
        ]),
        vnode.state.imageSelectorVisible
          ? m(ImageSelector, {game: vnode.attrs.game, close: () => { vnode.state.imageSelectorVisible = false }})
          : null
      ])
    }
  }
}
