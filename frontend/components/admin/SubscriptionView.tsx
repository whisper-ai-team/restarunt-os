"use client";

import React from "react";
import { Check, CreditCard, Calendar, History, Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks";

interface SubscriptionViewProps {
  restaurantId: string;
}

export default function SubscriptionView({ restaurantId }: SubscriptionViewProps) {
  const { subscription, loading, error } = useSubscription(restaurantId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">Failed to load subscription: {error || 'Unknown error'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Current Plan Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-md p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-8 justify-between items-start">
          <div className="flex-1 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Current Plan: <span className="text-indigo-600">{subscription.currentPlan.name}</span>
              </h3>
              <p className="text-gray-600 text-sm">
                Access to all features, unlimited calls, and advanced analytics for your growing business.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {subscription.currentPlan.features.map((feature, idx) => (
                <Feature key={idx} text={feature} />
              ))}
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end gap-4 min-w-[200px]">
            <div className="text-right">
              <div className="flex items-baseline gap-1 md:justify-end">
                <span className="text-4xl font-bold text-gray-900">${subscription.currentPlan.price}</span>
                <span className="text-gray-500 font-medium">/{subscription.currentPlan.billingCycle === 'monthly' ? 'month' : 'year'}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Billed {subscription.currentPlan.billingCycle}</p>
            </div>
            <button className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
              Manage Plan
            </button>
          </div>
        </div>
      </div>

      {/* Plans and Billing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Other Plans */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-bold text-gray-900">Explore Other Plans</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {subscription.availablePlans.map((plan, idx) => (
              <div key={idx} className={`bg-white p-6 rounded-xl border border-gray-200 shadow-md flex flex-col justify-between hover:shadow-lg transition-shadow relative overflow-hidden`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                    POPULAR
                  </div>
                )}
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-gray-900">{plan.name}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {plan.name === 'Basic' ? 'For single locations' : 'For growing franchises'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-gray-900">${plan.price}</span>
                      <span className="text-xs text-gray-500">/mo</span>
                    </div>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, fIdx) => (
                      <PlanFeature key={fIdx} text={feature} />
                    ))}
                  </ul>
                </div>
                <button 
                  className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
                    plan.price > subscription.currentPlan.price 
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {plan.price > subscription.currentPlan.price ? 'Upgrade Now' : 'Downgrade'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Billing Information */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-md p-6 h-full flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Billing Information</h3>
            <div className="flex-1 space-y-6">
              {/* Payment Method */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Payment Method</span>
                  {subscription.paymentMethod && (
                    <div className="h-4 w-8 bg-blue-800 rounded px-1 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-white italic">
                        {subscription.paymentMethod.type.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                {subscription.paymentMethod ? (
                  <>
                    <p className="text-sm font-medium text-gray-900">Ending in **** {subscription.paymentMethod.last4}</p>
                    <p className="text-xs text-gray-500 mt-1">Expires {subscription.paymentMethod.expiryMonth}/{subscription.paymentMethod.expiryYear}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No payment method on file</p>
                )}
              </div>

              {/* Next Billing Date */}
              {subscription.nextBillingDate && (
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase block mb-2">
                    Next Billing Date
                  </span>
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <Calendar size={18} className="text-gray-400" />
                    {new Date(subscription.nextBillingDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Amount to be charged: ${subscription.nextBillingAmount.toFixed(2)}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-3">
              <button className="flex items-center justify-center gap-2 w-full py-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg text-sm font-semibold transition-colors">
                <CreditCard size={18} />
                Update Payment Method
              </button>
              <button className="flex items-center justify-center gap-2 w-full py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors">
                <History size={18} />
                View Billing History
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
        <Check size={14} className="text-green-600" />
      </div>
      <span>{text}</span>
    </div>
  );
}

function PlanFeature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-gray-600">
      <Check size={18} className="text-indigo-600" />
      {text}
    </li>
  );
}
