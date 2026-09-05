export function getCurrentLocation() {
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation) return reject(new Error('This browser does not support GPS location.'));
    navigator.geolocation.getCurrentPosition(
      p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),
      e=>reject(new Error(e.code===1?'Location permission was denied. Please enable location access and try again.':e.code===2?'Your location is currently unavailable. Please move somewhere with a better GPS signal.':'GPS timed out. Please try again.')),
      {enableHighAccuracy:true,timeout:20000,maximumAge:0}
    );
  });
}
