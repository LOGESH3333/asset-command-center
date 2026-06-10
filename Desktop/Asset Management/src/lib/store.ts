import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type Role = 'Admin' | 'Employee' | 'Manager' | 'Finance' | 'Procurement';
export type AssetStatus = 'Available' | 'Allocated' | 'Under Maintenance' | 'Retired';
export type RequestStatus =
  | 'Pending Manager'
  | 'Pending Procurement'
  | 'Pending Finance'
  | 'Approved'
  | 'Purchasing'
  | 'Received'
  | 'Rejected';

export interface User {
  id: string;
  name: string;
  role: Role;
  department: string;
}

export interface Asset {
  id: string;
  name: string;
  category: string;
  purchaseDate: string;
  vendor: string;
  cost: number;
  warrantyExpiry: string;
  status: AssetStatus;
}

export interface AssetRequest {
  id: string;
  requesterId: string;
  assetCategory: string;
  justification: string;
  status: RequestStatus;
  createdAt: string;
}

export interface Allocation {
  id: string;
  assetId: string;
  userId: string;
  allocatedDate: string;
  returnDate: string | null;
}

export interface MaintenanceLog {
  id: string;
  assetId: string;
  type: 'Preventive' | 'Corrective';
  description: string;
  cost: number;
  date: string;
}

interface AppState {
  currentUser: User | null;
  users: User[];
  assets: Asset[];
  requests: AssetRequest[];
  allocations: Allocation[];
  maintenance: MaintenanceLog[];

  login: (userId: string) => void;
  logout: () => void;
  
  // Asset Actions
  addAsset: (asset: Omit<Asset, 'id'>) => void;
  updateAsset: (id: string, asset: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;

  // Request Actions
  createRequest: (request: Omit<AssetRequest, 'id' | 'createdAt' | 'status'>) => void;
  updateRequestStatus: (id: string, status: RequestStatus) => void;

  // Allocation Actions
  allocateAsset: (assetId: string, userId: string) => void;
  returnAsset: (allocationId: string) => void;
}

const mockUsers: User[] = [
  { id: '1', name: 'Admin User', role: 'Admin', department: 'IT' },
  { id: '2', name: 'John Employee', role: 'Employee', department: 'Engineering' },
  { id: '3', name: 'Sarah Manager', role: 'Manager', department: 'Engineering' },
  { id: '4', name: 'Mike Finance', role: 'Finance', department: 'Finance' },
  { id: '5', name: 'Lisa Procurement', role: 'Procurement', department: 'Operations' },
];

const mockAssets: Asset[] = [
  { id: 'a1', name: 'MacBook Pro M3', category: 'Laptop', purchaseDate: '2025-01-15', vendor: 'Apple', cost: 2500, warrantyExpiry: '2028-01-15', status: 'Available' },
  { id: 'a2', name: 'Dell UltraSharp 27"', category: 'Monitor', purchaseDate: '2024-11-10', vendor: 'Dell', cost: 450, warrantyExpiry: '2027-11-10', status: 'Allocated' },
  { id: 'a3', name: 'Herman Miller Aeron', category: 'Furniture', purchaseDate: '2023-05-20', vendor: 'Herman Miller', cost: 1200, warrantyExpiry: '2035-05-20', status: 'Available' },
];

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  users: mockUsers,
  assets: mockAssets,
  requests: [],
  allocations: [{ id: 'al1', assetId: 'a2', userId: '2', allocatedDate: '2025-02-01', returnDate: null }],
  maintenance: [],

  login: (userId) => set((state) => ({ currentUser: state.users.find(u => u.id === userId) || null })),
  logout: () => set({ currentUser: null }),

  addAsset: (asset) => set((state) => ({ assets: [...state.assets, { ...asset, id: uuidv4() }] })),
  updateAsset: (id, assetData) => set((state) => ({
    assets: state.assets.map(a => a.id === id ? { ...a, ...assetData } : a)
  })),
  deleteAsset: (id) => set((state) => ({ assets: state.assets.filter(a => a.id !== id) })),

  createRequest: (req) => set((state) => ({
    requests: [...state.requests, { ...req, id: uuidv4(), createdAt: new Date().toISOString(), status: 'Pending Manager' }]
  })),
  updateRequestStatus: (id, status) => set((state) => ({
    requests: state.requests.map(r => r.id === id ? { ...r, status } : r)
  })),

  allocateAsset: (assetId, userId) => set((state) => {
    // Update asset status
    const updatedAssets = state.assets.map(a => a.id === assetId ? { ...a, status: 'Allocated' as AssetStatus } : a);
    return {
      assets: updatedAssets,
      allocations: [...state.allocations, { id: uuidv4(), assetId, userId, allocatedDate: new Date().toISOString(), returnDate: null }]
    };
  }),
  returnAsset: (allocationId) => set((state) => {
    const allocation = state.allocations.find(a => a.id === allocationId);
    if (!allocation) return state;
    
    const updatedAllocations = state.allocations.map(a => a.id === allocationId ? { ...a, returnDate: new Date().toISOString() } : a);
    const updatedAssets = state.assets.map(a => a.id === allocation.assetId ? { ...a, status: 'Available' as AssetStatus } : a);
    
    return { allocations: updatedAllocations, assets: updatedAssets };
  }),
}));
