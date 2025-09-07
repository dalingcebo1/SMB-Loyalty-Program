import api from './api';

export interface PlanForm {
  name: string;
  price_cents: number;
  billing_period: 'monthly' | 'annual' | string;
  description?: string;
  module_keys: string[];
  active?: boolean;
}

export async function fetchPlans() {
  const { data } = await api.get('/subscriptions/plans');
  return data as { id:number; name:string; price_cents:number; billing_period:string; modules:string[]; active?:boolean }[];
}
export async function listAllPlans() {
  const { data } = await api.get('/subscriptions/plans/all');
  return data as { id:number; name:string; price_cents:number; billing_period:string; modules:string[]; active?:boolean }[];
}
export async function createPlan(form: PlanForm) {
  const payload = { name: form.name, price_cents: form.price_cents, billing_period: form.billing_period, module_keys: form.module_keys, description: form.description, active: form.active };
  const { data } = await api.post('/subscriptions/plans', payload);
  return data;
}
export async function updatePlan(id: number, form: PlanForm) {
  const payload = { name: form.name, price_cents: form.price_cents, billing_period: form.billing_period, module_keys: form.module_keys, description: form.description, active: form.active };
  const { data } = await api.put(`/subscriptions/plans/${id}`, payload);
  return data;
}
export async function archivePlan(id: number) {
  const { data } = await api.post(`/subscriptions/plans/${id}/archive`, {});
  return data;
}
export async function restorePlan(id: number) {
  const { data } = await api.post(`/subscriptions/plans/${id}/restore`, {});
  return data;
}
