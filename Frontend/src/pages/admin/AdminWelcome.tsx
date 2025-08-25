import React from 'react';
import ActionCard from '../../components/ui/ActionCard';
import { HiUsers, HiUserAdd, HiCog } from 'react-icons/hi';

/**
 * AdminWelcome - simplified admin dashboard with main quick actions
 */
const AdminWelcome: React.FC = () => (
  <div className="p-6">
    <h1 className="text-2xl font-semibold mb-6">Admin Dashboard</h1>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
      <ActionCard
        to="/admin/users"
        icon={<HiUsers className="w-7 h-7" />}
        title="Manage Users"
        description="View & manage user accounts"
      />
      <ActionCard
        to="/admin/register-staff"
        icon={<HiUserAdd className="w-7 h-7" />}
        title="Register Staff"
        description="Invite staff & assign roles"
      />
      <ActionCard
        to="/admin/modules"
        icon={<HiCog className="w-7 h-7" />}
        title="Modules & Settings"
        description="Enable features & configure options"
      />
    </div>
  </div>
);

export default AdminWelcome;
