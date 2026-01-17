"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  CheckCircle, 
  Store, 
  CreditCard, 
  Mic, 
  MapPin, 
  Loader2, 
  ChevronRight, 
  ChevronLeft,
  ShieldCheck,
  Radio
} from "lucide-react";

export default function NewRestaurantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    cloverMerchantId: "",
    cloverApiKey: "",
    cloverEnvironment: "sandbox",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    cuisineType: "Indian",
    voiceSelection: "alloy"
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
        setStep(step + 1);
        return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create restaurant");
      }

      router.push("/admin");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Store size={20} />
                </div>
                <div>
                    <h3 className="text-base font-semibold text-gray-900">Business Identity</h3>
                    <p className="text-xs text-gray-500">Tell us about your restaurant</p>
                </div>
            </div>
            <div className="space-y-4">
                <FormInput label="Restaurant Name" name="name" value={formData.name} onChange={handleChange} required />
                <FormInput label="Phone Number (E.164)" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="+15550001234" required />
                <div className="grid grid-cols-2 gap-4">
                    <FormSelect label="Cuisine Type" name="cuisineType" value={formData.cuisineType} onChange={handleChange} options={["Indian", "Mexican", "Chinese", "Italian", "American", "Japanese", "Thai"]} />
                    <FormSelect label="Voice Persona" name="voiceSelection" value={formData.voiceSelection} onChange={handleChange} options={[{label: "Alloy", value: "alloy"}, {label: "Echo", value: "echo"}, {label: "Shimmer", value: "shimmer"}]} />
                </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
             <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <MapPin size={20} />
                </div>
                <div>
                    <h3 className="text-base font-semibold text-gray-900">Location Details</h3>
                    <p className="text-xs text-gray-500">Where is your restaurant located?</p>
                </div>
            </div>
            <div className="space-y-4">
                <FormInput label="Street Address" name="address" value={formData.address} onChange={handleChange} required />
                <div className="grid grid-cols-2 gap-4">
                    <FormInput label="City" name="city" value={formData.city} onChange={handleChange} required />
                    <FormInput label="State" name="state" value={formData.state} onChange={handleChange} required />
                </div>
                <FormInput label="Zip Code" name="zipCode" value={formData.zipCode} onChange={handleChange} required />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
             <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <CreditCard size={20} />
                </div>
                <div>
                    <h3 className="text-base font-semibold text-gray-900">Clover Integration</h3>
                    <p className="text-xs text-gray-500">Connect your POS system</p>
                </div>
            </div>
            <div className="space-y-4">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                    {["sandbox", "prod"].map((env) => (
                        <button
                            key={env}
                            type="button"
                            onClick={() => setFormData({ ...formData, cloverEnvironment: env })}
                            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
                                formData.cloverEnvironment === env 
                                    ? "bg-white text-gray-900 shadow-sm" 
                                    : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            {env === 'sandbox' ? 'Sandbox' : 'Production'}
                        </button>
                    ))}
                </div>
                <FormInput label="Merchant ID" name="cloverMerchantId" value={formData.cloverMerchantId} onChange={handleChange} required />
                <FormInput label="Private API Key" name="cloverApiKey" value={formData.cloverApiKey} onChange={handleChange} type="password" required />
                
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
                    <ShieldCheck className="text-blue-600 shrink-0 mt-0.5" size={16} />
                    <p className="text-xs text-blue-900 leading-relaxed">
                        Your API keys are encrypted with AES-256 before storage. We never store credentials in plain text.
                    </p>
                </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center">
              <Radio className="text-white" size={18} />
            </div>
            <span className="text-base font-semibold text-gray-900">Hayman AI Voice AI</span>
          </Link>
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
            <ArrowLeft size={16} /> Cancel
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Onboard New Restaurant</h1>
            <p className="text-sm text-gray-600">Set up AI voice ordering in minutes</p>
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center items-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-2 h-2 rounded-full transition-colors ${
                  step >= s ? "bg-indigo-600" : "bg-gray-300"
                }`} />
                {s < 3 && <div className={`w-12 h-0.5 ${step > s ? "bg-indigo-600" : "bg-gray-300"}`} />}
              </div>
            ))}
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {renderStep()}

              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <ChevronLeft size={16} />
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      {step === 3 ? "Create Restaurant" : "Continue"}
                      {step < 3 && <ChevronRight size={16} />}
                      {step === 3 && <CheckCircle size={16} />}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormInput({ label, type = "text", ...props }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        {...props}
        type={type}
        className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400"
      />
    </div>
  );
}

function FormSelect({ label, options, ...props }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
      <select
        {...props}
        className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      >
        {options.map((opt: any) => (
          <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
            {typeof opt === 'string' ? opt : opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
