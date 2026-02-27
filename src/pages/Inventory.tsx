import React from 'react';
import { Edit3, Download } from 'lucide-react';
import { InventoryItem } from '../types';

interface InventoryProps {
    inventory: InventoryItem[];
    onUpdateStock?: (id: string, newQty: number) => void;
}

const Inventory: React.FC<InventoryProps> = ({ inventory, onUpdateStock }) => {
    // Fallback if inventory is undefined
    const items = inventory || [];

    const handleExport = () => {
        if (!items.length) {
            alert('No items to export.');
            return;
        }

        // CSV Header
        const headers = ['SKU', 'Name', 'Category', 'Status', 'Stock', 'Unit'];

        // CSV Rows
        const rows = items.map(item => {
            const sku = item.Raw_Material_ID || item.id || item.SKU_ID || '';
            const name = item.Material_Name || item.Product_Name || item.name || '';
            const category = item.category || '';
            const status = item.status || 'Active';
            const stock = item.Stock_Kg || item.qty || 0;
            const unit = item.unit || 'kg';

            // Escape commas in name
            const safeName = name.includes(',') ? `"${name}"` : name;

            return [sku, safeName, category, status, stock, unit].join(',');
        });

        // Combine
        const csvContent = [headers.join(','), ...rows].join('\n');

        // Create Blob & Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleEditStock = (item: InventoryItem) => {
        // Handle inconsistent naming from legacy data vs type definition
        const displayName = item.Material_Name || item.Product_Name || item.name;
        const currentStock = item.Stock_Kg || item.qty;
        const id = item.Raw_Material_ID || item.id || item.SKU_ID;

        // Fix: prompt expects string default
        const newQty = prompt(`Adjust stock for ${displayName}:`, String(currentStock || 0));

        if (newQty && !isNaN(parseInt(newQty))) {
            // Call parent handler to update Firestore
            if (onUpdateStock && id) {
                onUpdateStock(id, parseInt(newQty));
            }
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Raw Material Inventory</h2>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white font-medium transition-colors shadow-lg shadow-green-900/20"
                >
                    <Download size={18} />
                    Export CSV
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item, index) => {
                    const displayName = item.Material_Name || item.Product_Name || item.name;
                    const displayId = item.Raw_Material_ID || item.id || item.SKU_ID;
                    const displayStock = item.Stock_Kg || item.qty;
                    const displayLoc = item.loc_id || 'All Locations';

                    return (
                        <div key={`${displayId}-${index}`} className="bg-gray-800 p-5 rounded-xl border border-gray-700 flex justify-between items-center group hover:border-blue-500/50 transition-all">
                            <div>
                                <h4 className="font-bold text-white">{displayName}</h4>
                                <div className="flex gap-2 items-center mt-1">
                                    <p className="text-xs text-gray-500">ID: {displayId}</p>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-600/50 bg-gray-700/50 text-gray-400 font-bold uppercase">{displayLoc}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-mono font-bold text-blue-400">{displayStock} <span className="text-xs text-gray-500">kg</span></p>
                                <button
                                    onClick={() => handleEditStock(item)}
                                    className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                                >
                                    <Edit3 size={10} /> Edit Stock
                                </button>
                            </div>
                        </div>
                    );
                })}
                {items.length === 0 && (
                    <div className="col-span-full text-center text-gray-500 py-10">
                        No inventory items found.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Inventory;
