// Shared by the road mesh and the moving rig so the tires follow the same curve.
export function roadZ(x) {
  if(x>=-22&&x<=46)return 8+9*Math.sin(Math.PI*(x+22)/68)**2;
  if(x<=84)return 8;
  if(x>=166)return -34;
  const t=(x-84)/82;
  return 8+20*Math.sin(Math.PI*t)**2-42*t*t*(3-2*t);
}
export function roadSlope(x) {
  if(x>=-22&&x<=46)return 9*Math.PI/68*Math.sin(2*Math.PI*(x+22)/68);
  if(x<=84||x>=166)return 0;
  const t=(x-84)/82;
  return 20*Math.PI/82*Math.sin(2*Math.PI*t)-42*6*t*(1-t)/82;
}
export function roadFrame(x) {return {z:roadZ(x),heading:-Math.atan2(roadSlope(x),1)};}
