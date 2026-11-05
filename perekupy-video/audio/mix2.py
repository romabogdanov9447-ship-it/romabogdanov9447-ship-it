import numpy as np, sys
from scipy.io import wavfile
from scipy.signal import lfilter, butter
SR=44100; DUR=60.0; N=int(SR*DUR)
P=sys.argv[1]
rng=np.random.default_rng(3)

OLD_START=[0,6.6,12.8,24.8,30.8,40.4,47.8]; NEW_START=[0,5.8,11.7,21.27,26.07,33.97,40.03]
WARPS=[[[0,0],[1.5,1.33],[2.42,2.84],[3.64,4.09],[4.6,4.75],[5.8,6.6]],
[[0,0],[0.36,0.3],[1.34,1.28],[2.62,2.44],[4.94,4.1],[5.9,6.2]],
[[0,0],[0.34,0.3],[0.9,0.86],[1.8,2.15],[3.52,4.38],[5.44,6.88],[7.34,9.13],[8.66,10.46],[9.57,12]],
[[0,0],[0.37,0.3],[2.13,2.2],[2.45,2.39],[3.13,3.63],[3.87,4.54],[4.8,6.0]],
[[0,0],[0.37,0.3],[1.55,1.28],[2.39,2.63],[3.21,4.1],[3.93,5.52],[4.79,6.28],[5.71,7.06],[6.47,7.72],[7.9,9.6]],
[[0,0],[0.29,0.3],[1.57,1.62],[2.61,3.11],[2.95,3.51],[4.63,5.44],[5.21,6.03],[6.06,7.4]],
[[0,0],[0.47,0.3],[0.77,0.81],[3.29,3.35],[5.97,5.8],[6.85,7.28],[8.81,8.7],[9.39,9.96],[10.31,10.92],[11.61,12.73],[12.81,14.65],[14.61,16.32],[19.97,19.2]]]
def NT(T):
    k=max(i for i in range(7) if T>=OLD_START[i]-1e-9); lo=T-OLD_START[k]; w=WARPS[k]
    xs=[b for a,b in w]; ys=[a for a,b in w]
    return NEW_START[k]+float(np.interp(lo,xs,ys))
t=np.arange(N)/SR
def lp(x,fc,o=2): b,a=butter(o,fc/(SR/2)); return lfilter(b,a,x)
def hp(x,fc,o=2): b,a=butter(o,fc/(SR/2),'high'); return lfilter(b,a,x)
def bp(x,lo,hi): b,a=butter(2,[lo/(SR/2),hi/(SR/2)],'band'); return lfilter(b,a,x)
def env_lin(points):
    xs=[p[0] for p in points]; ys=[p[1] for p in points]; return np.interp(t,xs,ys)
L=np.zeros(N); R=np.zeros(N)
def add(sig,start,gain=1.0,pan=0.0):
    i=int(start*SR); n=min(len(sig),N-i)
    if n<=0: return
    L[i:i+n]+=sig[:n]*gain*np.sqrt(0.5*(1-pan)); R[i:i+n]+=sig[:n]*gain*np.sqrt(0.5*(1+pan))
def n2f(n): return 440*2**((n-69)/12)
BPM=100; beat=60/BPM; bar=4*beat
# ---- pad ----
chords=[[57,60,64,69],[53,57,60,65],[48,55,60,64],[55,59,62,67]]  # Am F C G
pad=np.zeros(N)
for ci in range(int(DUR/(2*bar))+1):
    ch=chords[ci%4]; s=int(ci*2*bar*SR); e=min(N,int((ci+1)*2*bar*SR)+int(0.3*SR))
    if s>=N: break
    tt=np.arange(e-s)/SR
    seg=np.zeros(e-s)
    for nn in ch:
        for d in (-0.08,0.0,0.08):
            f=n2f(nn-12)*2**(d/12); ph=rng.random()
            seg+= (2*((tt*f+ph)%1)-1)*0.06
    a=np.minimum(1,tt/0.6)*np.minimum(1,(len(tt)/SR-tt)/0.4+0.0)
    pad[s:e]+=seg*np.clip(a,0,1)
pad=lp(pad,900)
padEnv=env_lin([(0,0.35),(5.8,0.5),(11.7,0.55),(21.27,0.4),(26.07,0.6),(33.97,0.65),(40.03,0.8),(59,0.8),(60,0.3)])
add(pad*padEnv,0,0.9,-0.1); add(np.roll(pad,int(0.013*SR))*padEnv,0,0.9,0.1)
# ---- bass ----
bass=np.zeros(N)
roots=[45,41,36,43]
for k in range(int(DUR/(beat/2))):
    st=k*beat/2
    if st<5.8: continue
    if 21.27<=st<26.07 and k%4: continue
    r=roots[int(st/(2*bar))%4]; f=n2f(r-12)
    n=int(0.22*SR); tt=np.arange(n)/SR
    s=np.sin(2*np.pi*f*tt)*np.exp(-tt*7)+0.3*np.sin(4*np.pi*f*tt)*np.exp(-tt*12)
    i=int(st*SR); m=min(n,N-i); bass[i:i+m]+=s[:m]*0.35
add(bass,0,1.0)
# ---- drums ----
def kick():
    n=int(0.35*SR); tt=np.arange(n)/SR; f=50+90*np.exp(-tt*28); ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*np.exp(-tt*9)*0.9
def hat(): n=int(0.06*SR); tt=np.arange(n)/SR; return hp(rng.standard_normal(n),7000)*np.exp(-tt*60)*0.25
def clap():
    n=int(0.25*SR); tt=np.arange(n)/SR; x=bp(rng.standard_normal(n),900,3500)
    e=np.exp(-tt*18)+0.6*np.exp(-np.maximum(0,tt-0.012)*40)*(tt>0.012)
    return x*e*0.35
K,Hh,Cl=kick(),hat(),clap()
for k in range(int(DUR/beat)):
    st=k*beat
    if st<5.8 or st>59.2: continue
    sec4 = 21.27<=st<26.07
    if not sec4 or k%2==0: add(K,st,0.85 if not sec4 else 0.5)
    if st>=11.7 and not sec4: add(Hh,st+beat/2,0.9,0.3)
    if st>=26.07 and k%2==1 and not sec4: add(Cl,st,0.8,-0.1)
    if st>=40.03 and not sec4: add(Hh,st+beat/4,0.5,-0.3); add(Hh,st+3*beat/4,0.5,-0.3)
# ---- sfx ----
def whoosh(d=0.7,up=True):
    n=int(d*SR); tt=np.arange(n)/SR; x=rng.standard_normal(n)
    out=np.zeros(n); seg=int(0.02*SR)
    for i in range(0,n,seg):
        p=i/n; fc=(400+5000*p) if up else (5000-4600*p)
        out[i:i+seg]=bp(x[max(0,i-2000):i+seg],max(80,fc*0.6),min(18000,fc*1.4))[-len(out[i:i+seg]):]
    return out*np.sin(np.pi*tt/d)**2*0.6
def tone(f,d,decay=6,harm=(1,0.4,0.15)):
    n=int(d*SR); tt=np.arange(n)/SR; return sum(a*np.sin(2*np.pi*f*(i+1)*tt) for i,a in enumerate(harm))*np.exp(-tt*decay)*np.minimum(1,tt/0.004)
def pop(f=900): n=int(0.12*SR); tt=np.arange(n)/SR; fr=f*(1+1.5*np.exp(-tt*40)); return np.sin(2*np.pi*np.cumsum(fr)/SR)*np.exp(-tt*30)*0.35
def buzz(d=0.55):
    n=int(d*SR); tt=np.arange(n)/SR; x=np.sign(np.sin(2*np.pi*155*tt))*0.5+np.sin(2*np.pi*310*tt)*0.3
    x=lp(x,1200)*(0.6+0.4*np.sin(2*np.pi*31*tt)); return x*np.minimum(1,tt/0.02)*np.minimum(1,(d-tt)/0.04)*0.5
def impact():
    n=int(1.6*SR); tt=np.arange(n)/SR; f=40+70*np.exp(-tt*10); s=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*2.5)
    s+=lp(rng.standard_normal(n),2500)*np.exp(-tt*6)*0.4; return s*0.9
def tick(): n=int(0.03*SR); tt=np.arange(n)/SR; return bp(rng.standard_normal(n),2000,6000)*np.exp(-tt*200)*0.6
def thud(): n=int(0.5*SR); tt=np.arange(n)/SR; return (np.sin(2*np.pi*np.cumsum(70+80*np.exp(-tt*30))/SR)*np.exp(-tt*10)+lp(rng.standard_normal(n),800)*np.exp(-tt*25)*0.5)*0.8
def addT(sig,start,gain=1.0,pan=0.0): add(sig,NT(start),gain,pan)
# phone vibration
for k in range(3):
    addT(buzz(),3.55+k*1.1,0.9,0.2)
addT(tone(1568,0.6,5)+tone(2093,0.6,6)*0.6,3.9,0.25,0.2)            # notification
for b,up in [(6.6,True),(12.8,True),(24.8,False),(30.8,True),(40.4,False),(47.8,True)]: addT(whoosh(0.8,up),b-0.45,0.8)
addT(whoosh(1.0),2.2,0.25); addT(whoosh(1.2),9.6,0.4)                 # camera moves
for tt_,f in [(15.0,700),(16.8,800),(19.4,950),(20.2,1100),(21.6,600),(36.7,900),(37.2,1000),(41.4,900),(43.2,700),(43.4,800),(45.7,900),(57.6,900),(60.2,1100)]: addT(pop(f),tt_,0.9)
addT(tone(880,1.2,3)+tone(1320,1.2,3)*0.5,21.6,0.15)               # timer
for k in range(28): addT(tick(),26.8+k*0.05,0.5,0.3)                 # clock time-lapse
addT(thud(),28.95,0.9)                                               # sold stamp
# car pass
n=int(1.6*SR); tt=np.arange(n)/SR; eng=lp(np.sign(np.sin(2*np.pi*np.cumsum(45+10*tt)/SR))*0.4+rng.standard_normal(n)*0.2,600)
addT(eng*np.sin(np.pi*tt/1.6)**2,34.65,0.6,-0.4)
addT(lp(rng.standard_normal(int(0.4*SR)),3000)*np.exp(-np.arange(int(0.4*SR))/SR*8)*0.15,38.0,1.0)  # handshake rustle
# cash / coins
for k in range(10): addT(tone(2600+rng.random()*1800,0.35,14,(1,0.3)),43.55+k*0.06+rng.random()*0.03,0.18,rng.random()*1.2-0.6)
addT(tone(1046,1.5,2.5)+tone(1568,1.5,2.5)*0.6+tone(2093,1.5,3)*0.4,43.55,0.22)
addT(impact(),48.15,1.0)                                             # logo hit
addT(tone(523,2.5,1.5)+tone(784,2.5,1.5)*0.7+tone(1046,2.5,1.8)*0.5,48.2,0.18)
addT(tone(1318,1.5,2.5)+tone(1976,1.5,2.5)*0.5,60.2,0.15)
# heartbeat-ish pulse under final line
for k in range(5): addT(kick(),62.4+k*0.85,0.35)
addT(impact()*0.5,66.0,0.6)
mus=np.stack([L,R],1)
# ---- voice + ducking ----
sr,ux=wavfile.read(f"{P}/audio/user.wav"); ux=ux.astype(np.float32)/32768
CUTS=[0,5.15,10.55,19.62,23.92,31.32,36.88,51.96]; G=[0.4,6.05,11.95,21.52,26.32,34.22,40.28]
v=np.zeros(N)
for k in range(7):
    seg=ux[int(CUTS[k]*SR):int(CUTS[k+1]*SR)].copy(); f=int(0.01*SR); seg[:f]*=np.linspace(0,1,f); seg[-f:]*=np.linspace(1,0,f)
    j=int(G[k]*SR); m=min(len(seg),N-j); v[j:j+m]+=seg[:m]
ve=np.abs(v); ve=lfilter([1-0.9995],[1,-0.9995],ve)*12; ve=np.clip(ve,0,1)
duck=1-0.45*ve
mus=mus*duck[:,None]
mus=mus/np.max(np.abs(mus))*0.42
vox=v/np.max(np.abs(v))*0.92
out=mus+vox[:,None]
out=np.tanh(out*1.1)/np.tanh(1.1)
out*=np.minimum(1,(DUR-t)/0.5)[:,None]
wavfile.write(f"{P}/audio/mix.wav",SR,(out*32767*0.95).astype(np.int16))
print("ok", out.shape)
