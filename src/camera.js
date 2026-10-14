// Webcam transport only: no gesture labels or canned attack triggers.
export class PilotCamera {
 constructor({video,canvas,onStatus,onFrame}){Object.assign(this,{video,canvas,onStatus,onFrame});this.stream=null;this.model=null;this.modelPromise=null;this.active=false;this.starting=false;this.generation=0;this.lastFrame=0;this.lastVideoTime=-1;this.inferenceMs=0;}
 async loadModel(){
  if(this.model)return this.model;
  if(!this.modelPromise)this.modelPromise=(async()=>{
   const {FilesetResolver,PoseLandmarker}=await import('@mediapipe/tasks-vision');const files=await FilesetResolver.forVisionTasks('/wasm');
   const options={baseOptions:{modelAssetPath:'/models/pose_landmarker_lite.task',delegate:'GPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5};
   try{this.model=await PoseLandmarker.createFromOptions(files,options);}catch{options.baseOptions.delegate='CPU';this.model=await PoseLandmarker.createFromOptions(files,options);}return this.model;
  })().finally(()=>{this.modelPromise=null;});return this.modelPromise;
 }
 async start(){
  if(this.active||this.starting)return;const generation=++this.generation;this.starting=true;this.onStatus('loading','Meminta izin kamera…');
  try{
   const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:30},facingMode:'user'},audio:false});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.video.srcObject=stream;await this.video.play();if(generation!==this.generation)return;
   stream.getVideoTracks()[0].addEventListener('ended',()=>{if(this.active){this.stop();this.onStatus('error','Kamera terputus. Hubungkan kembali lalu aktifkan kamera.');}});
   this.onStatus('loading','Memuat pelacakan pose 3D lokal…');await this.loadModel();if(generation!==this.generation)return;
   this.canvas.width=this.video.videoWidth||640;this.canvas.height=this.video.videoHeight||480;this.lastVideoTime=-1;this.lastFrame=0;this.active=true;this.starting=false;this.onStatus('streaming','Duduk tegak. Pastikan bahu, siku, dan tangan terlihat.');
  }catch(error){if(generation!==this.generation)return;this.stop();const message=error.name==='NotAllowedError'?'Izin kamera belum diberikan. Izinkan kamera lalu coba lagi.':error.name==='NotFoundError'?'Kamera tidak ditemukan. Kamu bisa mencoba contoh gerak.':error.name==='NotReadableError'?'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.':'Pelacakan gagal dimuat. Coba aktifkan kamera kembali.';this.onStatus('error',message);console.warn('Camera initialization:',error.name,error.message);}
  finally{if(generation===this.generation)this.starting=false;}
 }
 stop(){++this.generation;this.active=false;this.starting=false;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;this.canvas.getContext('2d').clearRect(0,0,this.canvas.width,this.canvas.height);this.onFrame({landmarks:null,worldLandmarks:null,timestamp:performance.now()/1000});this.onStatus('off','Aktifkan kamera untuk menghubungkan tubuhmu.');}
 update(now){
  if(!this.active||!this.model||this.video.readyState<2||now-this.lastFrame<45||this.video.currentTime===this.lastVideoTime)return;
  this.lastFrame=now;this.lastVideoTime=this.video.currentTime;
  try{const start=performance.now(),result=this.model.detectForVideo(this.video,now);this.inferenceMs=performance.now()-start;const landmarks=result.landmarks?.[0],worldLandmarks=result.worldLandmarks?.[0];this.draw(landmarks);this.onFrame({landmarks,worldLandmarks,timestamp:now/1000});}
  catch(error){this.stop();this.onStatus('error','Pelacakan terhenti. Coba hubungkan kembali kamera.');console.warn('Pose tracking:',error.message);}
 }
 draw(points){const c=this.canvas.getContext('2d'),w=this.canvas.width,h=this.canvas.height;c.clearRect(0,0,w,h);if(!points)return;const edges=[[11,12],[11,13],[13,15],[12,14],[14,16],[15,19],[15,17],[16,20],[16,18],[11,23],[12,24]];c.strokeStyle='#7ce6ed';c.lineWidth=3;c.shadowColor='#7ce6ed';c.shadowBlur=7;for(const [a,b]of edges){if((points[a]?.visibility??0)<.5||(points[b]?.visibility??0)<.5)continue;c.beginPath();c.moveTo(points[a].x*w,points[a].y*h);c.lineTo(points[b].x*w,points[b].y*h);c.stroke();}c.fillStyle='#f7aa78';for(const i of [0,11,12,13,14,15,16,17,18,19,20]){const p=points[i];if(p&&p.visibility>.5){c.beginPath();c.arc(p.x*w,p.y*h,i<17?4:2.5,0,Math.PI*2);c.fill();}}c.shadowBlur=0;}
}
