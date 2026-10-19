export const nodeVertex = `
attribute float aSize, aImportance, aSelectionState, aActivity, aNodeType, aVisible;
attribute vec3 aColor;
uniform float uTime, uMotion, uDpr;
varying vec3 vColor;
varying float vState, vVisible, vActivity, vDepth;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  float arrival=exp(-max(0.0,uTime-aActivity)*5.0)*step(aActivity,uTime)*step(0.0,aActivity);
  float breath=1.0+0.04*sin(uTime*0.8+position.x*0.4)*uMotion;
  float emphasis=aSelectionState>1.5?1.5:(aSelectionState>0.5?1.2:1.0);
  gl_PointSize=clamp(aSize*breath*emphasis*(1.0+0.3*arrival)*pow(38.0/max(4.0,-mv.z),0.3),5.0,28.0)*2.0*uDpr;
  gl_Position=projectionMatrix*mv;
  vColor=aColor; vState=aSelectionState; vVisible=aVisible;
  vActivity=arrival;vDepth=exp(-max(0.0,-mv.z-35.0)*0.008);
}`;
export const nodeFragment = `
uniform float uBrightness;
varying vec3 vColor;
varying float vState,vVisible,vActivity,vDepth;
void main(){
  float r=length(gl_PointCoord-0.5)*2.0;if(r>1.0||vVisible<0.01)discard;
  float core=exp(-r*r*35.0),halo=pow(max(0.0,1.0-r),2.5)*0.28;
  float aa=max(fwidth(r),0.004);
  float mask=1.0-smoothstep(1.0-aa,1.0,r);
  float ring=(1.0-smoothstep(0.018-aa,0.018+aa,abs(r-0.62)))*step(2.5,vState)*0.55;
  float dim=vState< -0.5?0.16:1.0;
  vec3 color=mix(vColor,vec3(0.94,0.98,1.0),core*0.8);
  gl_FragColor=vec4(color*(core*2.1+halo+ring)*(1.0+vActivity*1.2)*uBrightness, (core+halo+ring)*mask*dim*vDepth*vVisible);
}`;
export const edgeVertex = `
attribute vec3 aColor,aNormal;
attribute float aT,aSeed,aLength,aState,aVisible;
uniform float uTime,uMotion;
varying vec3 vColor;varying float vT,vState,vVisible,vSeed,vDepth;
void main(){
  vec3 p=position+aNormal*sin(aT*3.14159265)*sin(aT*13.0+aSeed+uTime*0.22*uMotion)*aLength*0.006;
  vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;
  vT=aT;vState=aState;vVisible=aVisible;vSeed=aSeed;vColor=aColor;vDepth=exp(-max(0.0,-mv.z-35.0)*0.008);
}`;
export const edgeFragment = `
uniform float uTime,uMotion,uConnections;
varying vec3 vColor;varying float vT,vState,vVisible,vSeed,vDepth;
void main(){
  float flow=0.93+0.07*sin(vT*14.0-uTime*0.65*uMotion+vSeed);
  float opacity=vState>0.5?0.78:(vState< -0.5?0.025:0.2);
  gl_FragColor=vec4(vColor*1.1,opacity*flow*vVisible*vDepth*uConnections);
}`;
export const ribbonVertex = `
attribute vec3 aNext,aColor,aNormal;
attribute float aSide,aT,aStart,aDuration,aReverse,aIntensity,aSeed,aLength;
uniform vec2 uResolution;
uniform float uTime,uMotion,uZap;
varying vec3 vColor;varying float vT,vStart,vDuration,vReverse,vIntensity,vSide;
void main(){
  vec3 p=position+aNormal*sin(aT*3.14159265)*sin(aT*13.0+aSeed+uTime*0.22*uMotion)*aLength*0.006*(1.0-uZap);
  vec4 clip=projectionMatrix*modelViewMatrix*vec4(p,1.0);
  vec4 next=projectionMatrix*modelViewMatrix*vec4(aNext,1.0);
  vec2 dir=normalize((next.xy/max(0.001,next.w)-clip.xy/max(0.001,clip.w))*uResolution+vec2(0.0001));
  vec2 normal=vec2(-dir.y,dir.x);
  clip.xy+=normal*aSide*(uZap>0.5?1.25:2.5)/uResolution*clip.w;
  gl_Position=clip;vColor=aColor;vT=aT;vStart=aStart;vDuration=aDuration;vReverse=aReverse;vIntensity=aIntensity;vSide=aSide;
}`;
export const ribbonFragment = `
uniform float uTime,uZap,uPulseIntensity;
varying vec3 vColor;varying float vT,vStart,vDuration,vReverse,vIntensity,vSide;
void main(){
  float age=uTime-vStart;float progress=age/vDuration;
  float t=mix(vT,1.0-vT,vReverse);
  float head=exp(-pow((t-progress)/0.055,2.0));
  float trail=exp(-max(0.0,progress-t)*13.0)*step(t,progress)*0.28;
  float pulse=(head+trail)*step(0.0,progress)*step(progress,1.12);
  float zap=step(0.0,age)*(1.0-step(0.16,age))*min(age/0.02,1.0)*min((0.16-age)/0.08,1.0);
  float intensity=mix(pulse,zap,uZap)*vIntensity*uPulseIntensity;
  if(intensity<0.005)discard;
  float core=pow(max(0.0,1.0-abs(vSide)),0.4);
  gl_FragColor=vec4(mix(vColor,vec3(0.92,0.98,1.0),0.55)*2.5,intensity*core);
}`;
