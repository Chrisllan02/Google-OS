import React, { useState } from 'react';
import { 
  Video, Mic, MicOff, VideoOff, Hand, MonitorUp, MoreVertical, PhoneOff 
} from 'lucide-react';

interface MeetAppProps {
  onClose: () => void;
  data: any;
}

export default function MeetApp({ onClose, data }: MeetAppProps) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  return (
    <div className="flex flex-col h-full bg-[#202124] relative">
        <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-[#000000]/40 backdrop-blur px-4 py-2 rounded-lg text-white">
            <span className="font-medium text-sm">Daily Scrum</span>
            <span className="text-xs text-white/60">|</span>
            <span className="text-xs text-white/60">abc-defg-hij</span>
        </div>
        
        <div className="flex-1 p-4 grid grid-cols-2 gap-4">
            <div className="bg-[#3C4043] rounded-2xl relative overflow-hidden flex items-center justify-center group">
                {camOn ? (
                    <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop" className="w-full h-full object-cover" alt="Participant" />
                ) : (
                    <div className="w-32 h-32 rounded-full bg-purple-600 flex items-center justify-center text-4xl text-white font-bold">J</div>
                )}
                <span className="absolute bottom-4 left-4 text-white text-sm font-medium shadow-black drop-shadow-md">Julia Silva</span>
            </div>
            <div className="bg-[#3C4043] rounded-2xl relative overflow-hidden flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-orange-500 flex items-center justify-center text-4xl text-white font-bold">R</div>
                <span className="absolute bottom-4 left-4 text-white text-sm font-medium shadow-black drop-shadow-md">Roberto Alves</span>
                <div className="absolute top-4 right-4 bg-black/50 p-1.5 rounded-full"><MicOff size={16} className="text-red-500"/></div>
            </div>
        </div>

        <div className="h-20 bg-[#202124] flex items-center justify-center gap-4 px-4 pb-4">
            <button onClick={() => setMicOn(!micOn)} className={`p-4 rounded-full transition-all ${micOn ? 'bg-[#3C4043] hover:bg-[#4d5155] text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                {micOn ? <Mic size={20}/> : <MicOff size={20}/>}
            </button>
            <button onClick={() => setCamOn(!camOn)} className={`p-4 rounded-full transition-all ${camOn ? 'bg-[#3C4043] hover:bg-[#4d5155] text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                {camOn ? <Video size={20}/> : <VideoOff size={20}/>}
            </button>
            <button className="p-4 rounded-full bg-[#3C4043] hover:bg-[#4d5155] text-white">
                <Hand size={20}/>
            </button>
            <button className="p-4 rounded-full bg-[#3C4043] hover:bg-[#4d5155] text-white">
                <MonitorUp size={20}/>
            </button>
            <button className="p-4 rounded-full bg-[#3C4043] hover:bg-[#4d5155] text-white">
                <MoreVertical size={20}/>
            </button>
            <button onClick={onClose} className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center gap-2">
                <PhoneOff size={20}/> 
            </button>
        </div>
    </div>
  );
}