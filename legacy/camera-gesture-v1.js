import { GestureTracker } from './gestures.js';
export class PilotCamera {
 constructor({video,canvas,onStatus,onInput}){this.video=video;this.canvas=canvas;this.onStatus=onStatus;this.onInput=onInput;this.tracker=new GestureTracker();this.stream=null;this.model=null;this.active=false;this.starting=false;this.generation=0;this.lastFrame=0;this.lastVideoTime=-1;this.ready=false;this.latest=null;}
 async start(){
  if(this.active||this.starting)return;const generation=++this.generation;this.starting=true;this.onStatus('loading','Meminta izin kamera…');
  let stream;
  try{
   stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.video.srcObject=stream;await this.video.play();
   stream.getVideoTracks()[0].addEventListener('ended',()=>{if(this.active){this.stop();this.onStatus('error','Kamera terputus. Hubungkan kembali lalu aktifkan kamera.');}});
   this.onStatus('loading','Memuat pelacakan pose lokal…');
   if(!this.model){
    const {FilesetResolver,PoseLandmarker}=await import('@mediapipe/tasks-vision');
    const vision=await FilesetResolver.forVisionTasks('/wasm');
    if(generation!==this.generation)return;
    const options={baseOptions:{modelAssetPath:'/models/pose_landmarker_lite.task',delegate:'GPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5};
    try{this.model=await PoseLandmarker.createFromOptions(vision,options);}catch{options.baseOptions.delegate='CPU';this.model=await PoseLandmarker.createFromOptions(vision,options);}
   }
   if(generation!==this.generation)return;
   this.canvas.width=this.video.videoWidth||640;this.canvas.height=this.video.videoHeight||480;this.active=true;this.starting=false;this.calibrate();
  }catch(error){if(generation!==this.generation)return;this.stop();const message=error.name==='NotAllowedError'?'Izin kamera ditolak. Izinkan kamera di browser, lalu coba lagi.':error.name==='NotFoundError'?'Kamera tidak ditemukan. Kamu tetap bisa bermain dengan keyboard.':error.name==='NotReadableError'?'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.':'Pelacakan gagal dimuat. Coba aktifkan kamera kembali.';this.onStatus('error',message);console.warn('Camera initialization:',error.name,error.message);}
  finally{if(generation===this.generation)this.starting=false;}
 }
 calibrate(){this.ready=false;this.tracker.startCalibration();this.onStatus('calibrating','Duduk tegak, tangan santai tetapi terlihat. Tahan posisi 3 detik.');}
 stop(){++this.generation;this.active=false;this.starting=false;this.ready=false;this.latest=null;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;this.canvas.getContext('2d').clearRect(0,0,this.canvas.width,this.canvas.height);this.tracker.reset();this.onInput({visible:false,ready:false,actions:[],blocking:false});this.onStatus('off','Hubungkan gerakan tubuhmu ke robot.');}
 update(now){
  if(!this.active||!this.model||this.video.readyState<2||now-this.lastFrame<70||this.video.currentTime===this.lastVideoTime)return;
  this.lastFrame=now;this.lastVideoTime=this.video.currentTime;
  try{
   const result=this.model.detectForVideo(this.video,now);const points=result.landmarks?.[0];this.draw(points);
   const input=this.tracker.read(points,now/1000);this.latest=input;
   if(!input.visible){this.onStatus('lost',this.tracker.calibrating?'Pastikan bahu, siku, dan kedua tangan terlihat.':'Pose hilang. Kembali ke tengah bingkai kamera.');}
   else if(this.tracker.calibrating){this.onStatus('calibrating',`Tahan posisi duduk… ${Math.round((input.progress||0)*100)}%`);}
   else if(input.ready){const becameReady=!this.ready;this.ready=true;this.onStatus('ready',becameReady?'Kalibrasi selesai. Gerakkan tangan untuk menyerang.':'Neural link aktif. Pilot terdeteksi.');}
   this.onInput(input);
  }catch(error){this.stop();this.onStatus('error','Pelacakan terhenti. Aktifkan kembali kamera atau gunakan keyboard.');console.warn('Pose tracking:',error.message);}
 }
 draw(points){const c=this.canvas.getContext('2d'),w=this.canvas.width,h=this.canvas.height;c.clearRect(0,0,w,h);if(!points)return;const edges=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24]];c.strokeStyle='#7ce6ed';c.lineWidth=3;c.shadowColor='#7ce6ed';c.shadowBlur=8;for(const [a,b]of edges){if((points[a]?.visibility??0)<.45||(points[b]?.visibility??0)<.45)continue;c.beginPath();c.moveTo(points[a].x*w,points[a].y*h);c.lineTo(points[b].x*w,points[b].y*h);c.stroke();}c.fillStyle='#f7aa78';for(const i of [0,11,12,13,14,15,16]){const p=points[i];if(p&&p.visibility>.45){c.beginPath();c.arc(p.x*w,p.y*h,4,0,Math.PI*2);c.fill();}}c.shadowBlur=0;}
}
