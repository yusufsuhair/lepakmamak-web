"""Procedural textures for the Saloma Link (build_saloma.py) and the Wet Deck rooftop
(build_skydining.py), in the pbr_textures.py style: numpy, fixed seeds, tileable by construction,
colour as sRGB, normals as OpenGL tangent space, row 0 = top of the image.

Each generator returns (colour, normal) for kit.pbr(..., source=landmark_textures). The size in
the docstring is the real-world tile the drawing is made for; pass the same number as `tile`.

  paint       white micaceous steel paint, orange peel and faint weather streaks     1.0 m
  paving      flamed grey granite pavers 600 x 300 in stretcher bond                 1.2 m
  frit        walk-on glass: grey-green laminate with an anti-slip ceramic dot frit  0.3 m
  concrete    fair-faced concrete: mottles, pores and lift lines                     3.0 m
  brushed     brushed stainless, grain along u                                       1.0 m
  teak        teak decking boards 140 mm with 6 mm gaps, grain along u               2.0 m
  mosaic      25 mm pool mosaic in four blues with recessed grout                    0.5 m
  travertine  honed travertine slabs 600 x 600 with pits and banding                 1.2 m
"""
import numpy as np
from pbr_textures import fractal, white, blur, normal_from_height, rgb

def _cells(n,cols,rows,bond=0.0):
    """Row/column cell coordinates for a tile grid: (column id, row id, u in cell, v in cell).
    `bond` shifts every other row by that fraction of a cell (stretcher bond)."""
    yy,xx=np.mgrid[0:n,0:n]/n
    r=np.floor(yy*rows);fv=yy*rows-r
    cu=xx*cols+(r%2)*bond*1.0;c=np.floor(cu)%cols;fu=cu-np.floor(cu)
    return c.astype(int),r.astype(int),fu,fv

def _joint(fu,fv,n,cols,rows,px):
    """0 in a joint `px` pixels wide, rising to 1 a pixel inside the cell."""
    du=np.minimum(fu,1-fu)*n/cols;dv=np.minimum(fv,1-fv)*n/rows
    return np.clip((np.minimum(du,dv)-px/2)/1.2,0,1)

def paint(n=256):
    mott=fractal(n,2.4,101);peel=fractal(n,1.2,102)
    streak=np.clip((fractal(n,1.5,103,stretch=(1,14))-.62)*3,0,1)
    col=rgb((.94,.945,.94),.97+(mott-.5)*.05-streak*.06+(peel-.5)*.04)
    return np.clip(col,0,1),normal_from_height(peel*.5+mott*.2,n/400)

def paving(n=512):
    cols,rows=2,4
    c,r,fu,fv=_cells(n,cols,rows,.5)
    j=_joint(fu,fv,n,cols,rows,1.6)
    tone=np.random.default_rng(111).random((rows,cols))[r,c]
    speck=white(n,112);mott=fractal(n,2.0,113)
    col=rgb((.66,.66,.64),.9+(tone-.5)*.14+(mott-.5)*.12)
    col[speck>.968]*=.5;col[speck<.025]=col[speck<.025]*1.18+.03
    col*=(.45+.55*j)[...,None]
    return np.clip(col,0,1),normal_from_height(j*.9+mott*.15,n/160)

def frit(n=256):
    pitch=n/32                                         # 32 dots over the 0.3 m tile: 9.4 mm
    yy,xx=np.mgrid[0:n,0:n]
    dx=(xx%pitch)-pitch/2;dy=((yy+((xx//pitch)%2)*pitch/2)%pitch)-pitch/2
    dot=np.clip((pitch*.28-np.sqrt(dx*dx+dy*dy))/1.2,0,1)
    haze=fractal(n,2.2,121)
    col=rgb((.23,.30,.30),.9+(haze-.5)*.15)
    col=col*(1-dot[...,None])+np.array([.80,.82,.80])*dot[...,None]
    return np.clip(col,0,1),normal_from_height(dot*.3,n/300)

def concrete(n=512):
    mott=fractal(n,2.1,131)*.7+fractal(n,1.3,132)*.3
    pores=blur(white(n,133),1);pit=np.clip((pores-.8)*6,0,1)
    lift=np.abs(np.sin(np.mgrid[0:n,0:n][0]/n*np.pi*2))**40      # a pour line across each tile
    col=rgb((.74,.73,.70),.9+(mott-.5)*.2-pit*.25-lift*.05)
    return np.clip(col,0,1),normal_from_height(mott*.3-pit*.7-lift*.3,n/200)

def brushed(n=512):
    grain=fractal(n,1.1,141,stretch=(60,1))*.6+fractal(n,1.8,142,stretch=(20,1))*.4
    col=rgb((.80,.81,.82),.92+(grain-.5)*.16)
    return np.clip(col,0,1),normal_from_height(grain*.5,n/300)

def teak(n=1024):
    boards=14;gap=3.0                                  # 143 mm boards, ~6 mm gaps on the 2 m tile
    yy,xx=np.mgrid[0:n,0:n]/n
    row=np.floor(yy*boards).astype(int);fv=yy*boards-row
    rng=np.random.default_rng(151);ends=rng.random((boards,2));tone=rng.random(boards)
    fu1=(xx-ends[row,0])%1;fu2=(xx-ends[row,1])%1
    seg=(fu1<(ends[row,1]-ends[row,0])%1).astype(int)   # which of the two planks in this row
    butt=np.minimum(np.minimum(fu1,1-fu1),np.minimum(fu2,1-fu2))*n
    edge=np.minimum(fv,1-fv)*n/boards
    seam=np.clip((np.minimum(edge,butt*1.0)-gap/2)/1.3,0,1)
    fibre=fractal(n,1.9,152,stretch=(12,1))*.6+fractal(n,1.2,153,stretch=(40,1))*.4
    # growth lines: wavy dark streaks running the length of each plank
    lines=np.abs(np.sin(yy*n/5.3+fractal(n,2.2,155,stretch=(6,1))*14+row*2.3+seg*1.9))**14
    streak=np.clip((fractal(n,1.4,156,stretch=(50,1))-.66)*4,0,1)
    ptone=(tone[row]+seg*.37)%1
    col=rgb((.70,.50,.33),.86+(ptone-.5)*.26+(fibre-.5)*.34-lines*.16-streak*.18+(white(n,154)-.5)*.04)
    col*=(.18+.82*seam)[...,None]
    return np.clip(col,0,1),normal_from_height(seam*1.2+fibre*.35-lines*.08,n/240)

def mosaic(n=512):
    k=20
    c,r,fu,fv=_cells(n,k,k)
    j=_joint(fu,fv,n,k,k,2.0)
    pal=np.array([[.36,.66,.75],[.29,.57,.70],[.46,.75,.81],[.24,.50,.65],[.55,.82,.86]])
    pick=np.random.default_rng(161).choice(len(pal),size=(k,k),p=[.34,.28,.18,.12,.08])
    glaze=1+(fv-.5)*.06-(np.abs(fu-.5)+np.abs(fv-.5))*.05
    col=pal[pick[r,c]]*(glaze+(blur(white(n,162),1)-.5)*.05)[...,None]
    col=col*j[...,None]+np.array([.82,.86,.84])*(1-j[...,None])
    bevel=np.clip(np.minimum(np.minimum(fu,1-fu),np.minimum(fv,1-fv))*n/k/2.5,0,1)
    return np.clip(col,0,1),normal_from_height(j*.6+bevel*.4,n/180)

def travertine(n=512):
    c,r,fu,fv=_cells(n,2,2)
    j=_joint(fu,fv,n,2,2,1.6)
    band=fractal(n,1.7,171,stretch=(10,1));mott=fractal(n,2.3,172)
    pits=np.clip((blur(white(n,173),1)-.78)*5,0,1)*np.clip((fractal(n,1.4,174)-.35)*3,0,1)
    tone=np.random.default_rng(175).random((2,2))[r,c]
    col=rgb((.88,.83,.74),.9+(band-.5)*.16+(mott-.5)*.1+(tone-.5)*.06-pits*.22)
    col*=(.6+.4*j)[...,None]
    return np.clip(col,0,1),normal_from_height(j*.5-pits*.6+band*.08,n/220)
