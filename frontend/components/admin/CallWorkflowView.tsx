"use client";

import React, { useState, useEffect } from "react";
import { 
  Phone, 
  Mic,
  Shield,
  Home,
  GitBranch,
  Bot,
  PhoneOff,
  Bell,
  Mail,
  MessageSquare,
  Plus,
  X,
  Lock,
  Settings,
  CheckCircle,
  ChevronDown,
  Headphones,
  Play,
  Loader2,
  Clock,
  Calendar,
  MessageCircle,
  Send
} from "lucide-react";
import { useWorkflowConfig } from "@/hooks";
import VoiceSelector from "./VoiceSelector";

interface CallWorkflowViewProps {
  restaurantId: string;
}

export default function CallWorkflowView({ restaurantId }: CallWorkflowViewProps) {
  const { config, loading, error, updateConfig } = useWorkflowConfig(restaurantId);
  const [selectedNode, setSelectedNode] = useState<string | null>("notifications");
  
  // Local state for editing
  const [voiceSettings, setVoiceSettings] = useState({ persona: "alloy", language: "en-US", speed: 1.0 });
  const [notifications, setNotifications] = useState({ 
    customMessage: "", 
    promotions: [] as string[], 
    emailRecipients: [] as string[], 
    phoneNumbers: [] as string[] 
  });
  const [messages, setMessages] = useState({ greeting: "", endCall: "" });

  const [isSaving, setIsSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Business Hours & Testing State
  const [businessHours, setBusinessHours] = useState<any>({});
  const [timezone, setTimezone] = useState("America/New_York");
  
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  // Sync config with local state
  useEffect(() => {
    if (config) {
      setVoiceSettings(config.voiceSettings);
      setNotifications(config.notifications);
      setMessages({
        greeting: config.greetingMessage || "",
        endCall: config.endCallMessage || ""
      });
      // @ts-ignore
      setBusinessHours(config.businessHours || {});
      // @ts-ignore
      setTimezone(config.timezone || "America/New_York");
    }
  }, [config]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateConfig({ 
        voiceSettings,
        notifications,
        greetingMessage: messages.greeting,
        endCallMessage: messages.endCall,
        // @ts-ignore
        businessHours,
        // @ts-ignore
        timezone
      });
      setSelectedNode(null);
    } catch (err) {
      console.error("Failed to save workflow:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestSMS = async () => {
     if (!testPhoneNumber) return;
     setIsSendingTest(true);
     setTestResult(null);
     try {
       const res = await fetch(`/api/restaurants/${restaurantId}/test-sms`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ 
           phoneNumber: testPhoneNumber, 
           message: notifications.customMessage || "This is a test message from your AI Agent." 
         })
       });
       if (res.ok) setTestResult("success");
       else setTestResult("error");
     } catch (e) {
       setTestResult("error");
     } finally {
       setIsSendingTest(false);
     }
  };

  const updateSchedule = (day: string, field: string, value: any) => {
    setBusinessHours((prev: any) => ({
      ...prev,
      [day]: { 
        ...(prev[day] || { open: "09:00", close: "22:00", closed: false }), 
        [field]: value 
      }
    }));
  };

  const togglePromotion = (promo: string) => {
    setNotifications(prev => {
      const exists = prev.promotions.includes(promo);
      return {
        ...prev,
        promotions: exists 
          ? prev.promotions.filter(p => p !== promo)
          : [...prev.promotions, promo]
      };
    });
  };

  const addEmail = () => {
    if (newEmail && !notifications.emailRecipients.includes(newEmail)) {
      setNotifications(prev => ({
        ...prev,
        emailRecipients: [...prev.emailRecipients, newEmail]
      }));
      setNewEmail("");
    }
  };

  const addPhone = () => {
    if (newPhone && !notifications.phoneNumbers.includes(newPhone)) {
      setNotifications(prev => ({
        ...prev,
        phoneNumbers: [...prev.phoneNumbers, newPhone]
      }));
      setNewPhone("");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">Failed to load workflow: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-50 via-white to-indigo-50 border border-indigo-100 rounded-lg py-3 px-4 flex items-center justify-between">
        <div className="flex-1"></div>
        <div className="flex items-center gap-3 text-indigo-900">
          <Play size={16} className="text-indigo-600" />
          <span className="font-medium text-sm">Create your first AI phone agent in under 60 seconds.</span>
          <button className="bg-white hover:bg-gray-50 border border-indigo-200 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm font-semibold transition-all shadow-sm">
            <Play size={14} className="text-indigo-600" />
            Watch Tutorial
          </button>
        </div>
        <div className="flex-1"></div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Agent Voice Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start gap-5 mb-4">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <Mic size={24} />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900">Agent Voice</h3>
              <p className="text-sm text-gray-500 mt-1">Choose a voice that matches your brand personality</p>
            </div>
          </div>
          <VoiceSelector 
            selected={voiceSettings.persona} 
            onChange={(voiceId) => setVoiceSettings(prev => ({ ...prev, persona: voiceId }))}
          />
        </div>

        {/* Agent Guidelines Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-5">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900">Agent Guidelines</h3>
                <p className="text-sm text-gray-500 mt-1">Define behavioral rules and boundaries.</p>
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 hover:border-blue-300 text-sm font-semibold text-gray-700 transition-all shadow-sm">
              <Settings size={16} className="text-gray-400" />
              Configure
            </button>
          </div>
        </div>
      </div>

      {/* Call Flows Designer */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden" style={{ height: "750px" }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
          <div>
            <h2 className="font-bold text-lg text-gray-900">Call Flows</h2>
            <p className="text-sm text-gray-500 mt-0.5">Visually design how the conversation progresses.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 bg-gray-50 pl-4 pr-3 py-2 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Status</span>
              <div className="relative inline-block w-10 h-5">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-10 h-5 bg-gray-300 peer-checked:bg-indigo-600 rounded-full peer transition-colors"></div>
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-transform"></div>
              </div>
            </div>
            <button className="text-sm font-semibold text-indigo-600 hover:text-white hover:bg-indigo-600 flex items-center gap-2 px-4 py-2 border border-indigo-200 rounded-xl bg-indigo-50 hover:shadow-md transition-all">
              <Settings size={14} />
              Edit <span className="font-bold">Default Workflow</span>
            </button>
          </div>
        </div>

        {/* Flow Canvas */}
        <div className="flex h-full overflow-hidden" style={{ height: "calc(100% - 80px)" }}>
          <div className="flex-1 bg-gray-50 relative overflow-auto p-8" style={{ 
            backgroundImage: "radial-gradient(#e2e8f0 1.5px, transparent 1.5px)",
            backgroundSize: "20px 20px"
          }}>
            <div className="flex flex-col gap-8 items-center pt-8 max-w-3xl mx-auto">
              {/* Node 0: Business Hours (New) */}
              <div className="relative group w-full max-w-sm">
                <div className="absolute -top-3 left-4 bg-gray-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-lg uppercase">
                  <Clock size={10} />
                  Operational Check
                </div>
                <div 
                  className={`bg-white rounded-xl border-2 p-5 shadow-md hover:shadow-xl transition-all cursor-pointer ${selectedNode === 'schedule' ? 'border-gray-500 ring-4 ring-gray-100' : 'border-gray-200'}`}
                  onClick={() => setSelectedNode("schedule")}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-gray-100 text-gray-600 p-2 rounded-lg">
                      <Calendar size={20} />
                    </div>
                    <h4 className="font-bold text-gray-900">Business Hours</h4>
                  </div>
                  <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                    "Check if open ({config?.timezone || "EST"}). If closed, reject call."
                  </p>
                </div>
                {/* Connection Line */}
                <div className="flex justify-center my-4">
                  <div className="w-0.5 h-12 border-l-2 border-dashed border-gray-300"></div>
                </div>
              </div>

              {/* Node 1: Greeting */}
              <div className="relative group w-full max-w-sm">
                <div className="absolute -top-3 left-4 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-lg uppercase">
                  <Phone size={10} />
                  Call Answered
                </div>
                <div 
                  className={`bg-white rounded-xl border-2 p-5 shadow-md hover:shadow-xl transition-all cursor-pointer ${selectedNode === 'greeting' ? 'border-indigo-500 ring-4 ring-indigo-100' : 'border-gray-200'}`}
                  onClick={() => setSelectedNode("greeting")}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-green-100 text-green-600 p-2 rounded-lg">
                      <Home size={20} />
                    </div>
                    <h4 className="font-bold text-gray-900">Greeting Message</h4>
                  </div>
                  <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                    "{messages.greeting || "Thank you for calling Bawarchi! How can I help you today?"}"
                  </p>
                </div>
                {/* Connection Line */}
                <div className="flex justify-center my-4">
                  <div className="w-0.5 h-12 border-l-2 border-dashed border-gray-300"></div>
                </div>
              </div>

              {/* Node 2: Call Flow (Locked) */}
              <div className="relative group w-full max-w-sm">
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 shadow-sm opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 text-blue-400 p-2 rounded-lg grayscale">
                        <GitBranch size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-500">Call Flow</h4>
                        <span className="text-[10px] text-gray-400">Identify Purpose & Goals</span>
                      </div>
                    </div>
                    <Lock size={20} className="text-gray-400" />
                  </div>
                </div>
                <div className="flex justify-center my-4">
                  <div className="w-0.5 h-12 border-l-2 border-dashed border-gray-300"></div>
                </div>
              </div>

              {/* Node 3: AI Flow (Locked) */}
              <div className="relative group w-full max-w-sm">
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 shadow-sm opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 text-purple-400 p-2 rounded-lg grayscale">
                        <Bot size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-500">AI Flow</h4>
                        <span className="text-[10px] text-gray-400">Core Logic Processing</span>
                      </div>
                    </div>
                    <Lock size={20} className="text-gray-400" />
                  </div>
                </div>
                <div className="flex justify-center my-4">
                  <div className="w-0.5 h-12 border-l-2 border-dashed border-gray-300"></div>
                </div>
              </div>

              {/* Node 4: End Call */}
              <div className="relative group w-full max-w-sm">
                <div 
                  className={`bg-white rounded-xl border-2 p-4 shadow-md hover:shadow-lg transition-all cursor-pointer ${selectedNode === 'endCall' ? 'border-red-400 ring-4 ring-red-100' : 'border-gray-200'}`}
                  onClick={() => setSelectedNode("endCall")}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-red-50 text-red-500 p-2 rounded-lg">
                      <PhoneOff size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">End Call</h4>
                      <p className="text-[10px] text-gray-500">"{messages.endCall || "Have a great day!"}"</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center my-4">
                  <div className="w-0.5 h-12 border-l-2 border-dashed border-gray-300"></div>
                </div>
              </div>

              {/* Node 5: Notifications (Active/Selected) */}
              <div className="relative group w-full max-w-sm self-end translate-x-[20%] mt-4">
                <div className="absolute -top-3 left-4 bg-pink-100 text-pink-600 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm uppercase">
                  Post Call
                </div>
                <div 
                  className={`bg-white rounded-xl border-2 p-5 shadow-lg cursor-pointer ring-4 transition-all ${selectedNode === 'notifications' ? 'border-indigo-500 ring-indigo-100' : 'border-gray-200 ring-transparent hover:border-indigo-300'}`}
                  onClick={() => setSelectedNode("notifications")}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg">
                      <Bell size={20} />
                    </div>
                    <h4 className="font-bold text-gray-900">Email & SMS Notifications</h4>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 pl-11">
                    Configure Post-Call Promotional SMS.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Node Configuration */}
          {selectedNode && (
            <div className="w-[420px] bg-white border-l border-gray-200 flex flex-col overflow-y-auto shadow-xl">
              {/* Sidebar Header */}
              <div className="p-5 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${
                    selectedNode === 'greeting' ? 'bg-green-100 text-green-600' :
                    selectedNode === 'endCall' ? 'bg-red-100 text-red-600' :
                    selectedNode === 'schedule' ? 'bg-gray-100 text-gray-600' :
                    'bg-indigo-50 text-indigo-600'
                  }`}>
                    {selectedNode === 'greeting' ? <Home size={18} /> :
                     selectedNode === 'endCall' ? <PhoneOff size={18} /> :
                     selectedNode === 'schedule' ? <Clock size={18} /> :
                     <Bell size={18} />}
                  </div>
                  <h3 className="font-bold text-base text-gray-900">
                    {selectedNode === 'greeting' ? 'Greeting Configuration' :
                     selectedNode === 'endCall' ? 'End Call Settings' :
                     selectedNode === 'schedule' ? 'Business Hours' :
                     'Post-Call Notifications'}
                  </h3>
                </div>
                <button 
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => setSelectedNode(null)}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Sidebar Content - Dynamic based on Node */}
              <div className="p-6 space-y-8 flex-1">
                
                {selectedNode === 'schedule' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Timezone</label>
                      <select 
                        className="w-full rounded-lg border border-gray-300 p-2 text-sm bg-white"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                      >
                        <option value="America/New_York">Eastern Time (ET)</option>
                        <option value="America/Chicago">Central Time (CT)</option>
                        <option value="America/Denver">Mountain Time (MT)</option>
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      </select>
                    </div>

                    <div className="space-y-3">
                         <label className="block text-sm font-semibold text-gray-700">Weekly Schedule</label>
                         {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                           <div key={day} className="flex items-center gap-2 text-sm">
                             <div className="w-24 capitalize font-medium text-gray-600">{day}</div>
                             <input 
                               type="checkbox" 
                               checked={!(businessHours[day]?.closed)}
                               onChange={(e) => updateSchedule(day, 'closed', !e.target.checked)}
                               className="rounded border-gray-300 text-indigo-600"
                             />
                             {!(businessHours[day]?.closed) ? (
                               <div className="flex items-center gap-1">
                                 <input 
                                   type="time" 
                                   value={businessHours[day]?.open || "09:00"}
                                   onChange={(e) => updateSchedule(day, 'open', e.target.value)}
                                   className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                 />
                                 <span className="text-gray-400">-</span>
                                 <input 
                                   type="time" 
                                   value={businessHours[day]?.close || "22:00"}
                                   onChange={(e) => updateSchedule(day, 'close', e.target.value)}
                                   className="border border-gray-200 rounded px-1 py-0.5 text-xs w-20"
                                 />
                               </div>
                             ) : (
                               <span className="text-xs text-gray-400 italic px-2">Closed</span>
                             )}
                           </div>
                         ))}
                    </div>
                  </div>
                )}
                {selectedNode === 'greeting' && (
                  <div className="space-y-4">
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-2">Initial Greeting</label>
                       <textarea
                         className="w-full rounded-lg border border-gray-300 p-3 min-h-[120px] text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none leading-relaxed"
                         value={messages.greeting}
                         onChange={(e) => setMessages(prev => ({ ...prev, greeting: e.target.value }))}
                         placeholder="e.g. Thank you for calling Bawarchi! How can I help you?"
                       />
                       <p className="text-xs text-gray-500 mt-2">The very first thing the AI says when fetching the call.</p>
                     </div>
                  </div>
                )}

                {selectedNode === 'endCall' && (
                  <div className="space-y-4">
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-2">End Call Message</label>
                       <textarea
                         className="w-full rounded-lg border border-gray-300 p-3 min-h-[120px] text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none leading-relaxed shadow-sm"
                         value={messages.endCall}
                         onChange={(e) => setMessages(prev => ({ ...prev, endCall: e.target.value }))}
                         placeholder="e.g. Thank you for choosing us. We look forward to seeing you soon!"
                       />
                       <p className="text-xs text-gray-500 mt-2">The final message spoken before the AI hangs up.</p>
                     </div>
                  </div>
                )}

                {selectedNode === "notifications" && (
                  <>
                    {/* Post-Call Promotional SMS */}
                    <div className="space-y-3 bg-pink-50 p-4 rounded-xl border border-pink-100">
                      <div className="flex items-center gap-2 mb-1">
                          <MessageSquare size={16} className="text-pink-600"/>
                          <label className="block text-sm font-bold text-gray-900">Post-Call Promotional SMS</label>
                      </div>
                      <p className="text-xs text-gray-600 mb-3">
                        Automatically send a text message after every successful call. Great for coupons or surveys.
                      </p>
                      <textarea
                        className="w-full rounded-lg border border-pink-200 p-3 min-h-[80px] text-sm text-gray-900 focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none bg-white"
                        placeholder="e.g. Thanks for calling! Use code WE20 for 20% off your next online order."
                        value={notifications.customMessage}
                        onChange={(e) => setNotifications(prev => ({ ...prev, customMessage: e.target.value }))}
                      />
                    </div>

                    {/* Append Promotions */}
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">Append Offers to SMS</label>
                      <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                        {["Weekday Specials", "Weekend Specials", "Happy Hour Offers", "Catering Promotions"].map((promo, idx) => (
                          <label key={idx} className="flex items-center gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={notifications.promotions.includes(promo)}
                              onChange={() => togglePromotion(promo)}
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span className={`text-sm ${notifications.promotions.includes(promo) ? "font-medium text-indigo-700" : "text-gray-600"} group-hover:text-gray-900 transition-colors`}>
                              {promo}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Email Recipients */}
                    <div className="space-y-3 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-semibold text-gray-700">Internal Alerts (Email)</label>
                        <span className="text-xs text-gray-400">Optional</span>
                      </div>
                      <div className="space-y-2">
                        {notifications.emailRecipients.map((email, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-100 rounded-lg group">
                            <Mail size={14} className="text-blue-500 ml-1" />
                            <span className="text-sm text-blue-700 flex-1 truncate">{email}</span>
                            <button 
                              className="text-blue-400 hover:text-red-500 transition-colors"
                              onClick={() => setNotifications(prev => ({
                                ...prev,
                                emailRecipients: prev.emailRecipients.filter((_, i) => i !== idx)
                              }))}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                            <input 
                                type="email" 
                                placeholder="manager@example.com" 
                                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                            />
                            <button onClick={addEmail} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200">
                                <Plus size={16} />
                            </button>
                        </div>
                      </div>
                    </div>

                    {/* Phone Numbers */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-semibold text-gray-700">Internal Alerts (SMS)</label>
                        <span className="text-xs text-gray-400">Optional</span>
                      </div>
                      <div className="space-y-2">
                        {notifications.phoneNumbers.map((phone, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-purple-50 border border-purple-100 rounded-lg group">
                                <Phone size={14} className="text-purple-500 ml-1" />
                                <span className="text-sm text-purple-700 flex-1 truncate">{phone}</span>
                                <button 
                                className="text-purple-400 hover:text-red-500 transition-colors"
                                onClick={() => setNotifications(prev => ({
                                    ...prev,
                                    phoneNumbers: prev.phoneNumbers.filter((_, i) => i !== idx)
                                }))}
                                >
                                <X size={16} />
                                </button>
                            </div>
                        ))}
                        <div className="relative">
                            <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                            type="text"
                            className="w-full pl-10 pr-16 rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Enter phone..."
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addPhone()}
                            />
                            <button 
                                onClick={addPhone}
                                className="absolute right-1 top-1 px-3 py-1.5 bg-gray-100 text-xs font-semibold text-gray-600 rounded hover:bg-gray-200 transition-colors"
                            >
                            Add
                            </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Sidebar Footer */}
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                  {isSaving ? "Save Changes" : "Save Changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Test Button */}
      <div className="flex justify-end">
        <button 
          onClick={() => setIsTestModalOpen(true)}
          className="px-5 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
        >
          <Headphones size={18} />
          Test Your Agent
        </button>
      </div>

      {/* Test SMS Modal */}
      {isTestModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <h3 className="font-bold text-gray-900 flex items-center gap-2">
                 <MessageCircle size={18} className="text-indigo-600"/>
                 Send Test SMS
               </h3>
               <button onClick={() => setIsTestModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                 <X size={20} />
               </button>
             </div>
             
             <div className="p-6 space-y-4">
               <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg border border-blue-100">
                 This will send the currently configured "Post-Call Promotional SMS" to the number below.
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                 <input 
                   type="tel" 
                   placeholder="+1 (555) 000-0000"
                   className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                   value={testPhoneNumber}
                   onChange={(e) => setTestPhoneNumber(e.target.value)}
                 />
               </div>

               {testResult === 'success' && (
                 <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                   <CheckCircle size={16} /> SMS Sent Successfully!
                 </div>
               )}
               
               {testResult === 'error' && (
                 <div className="text-red-500 text-sm font-medium">
                   Failed to send SMS. Check logs.
                 </div>
               )}
             </div>

             <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
               <button 
                 onClick={() => setIsTestModalOpen(false)}
                 className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleSendTestSMS}
                 disabled={isSendingTest || !testPhoneNumber}
                 className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors"
               >
                 {isSendingTest ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                 Send Text
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
