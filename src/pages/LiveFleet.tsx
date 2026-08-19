import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// 修复 Leaflet 默认图标丢失问题
import markerIconPng from 'leaflet/dist/images/marker-icon.png';
import markerShadowPng from 'leaflet/dist/images/marker-shadow.png';
import { useTranslation } from "react-i18next";

interface DriverLocation {
  id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  updated_at: string;
  driver_name?: string;
  driver_email?: string;
  vehicle_plate?: string;
  has_driver: boolean;        // 是否有人驾驶
  is_active_driving: boolean; // 是否处于行驶/送货状态
}

const CITY_COORDS: Record<string, [number, number]> = {
  'shah alam': [3.0738, 101.5183],
  'kl': [3.1390, 101.6869],
  'kuala lumpur': [3.1390, 101.6869],
  'selangor': [3.0738, 101.5183],
  'nilai': [2.8167, 101.7972],
  'johor': [1.4927, 103.7414],
  'jb': [1.4927, 103.7414],
  'pasir gudang': [1.4700, 103.9000],
  'penang': [5.4164, 100.3327],
  'taiping': [4.8500, 100.7333],
  'batu pahat': [1.8548, 102.9325],
  'melaka': [2.1896, 102.2501],
  'kuantan': [3.8077, 103.3260],
  'ipoh': [4.5975, 101.0901],
};

function getCityCoordinate(addressText: string): [number, number] | null {
  const str = (addressText || '').toLowerCase();
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (str.includes(key)) {
      return coords;
    }
  }
  return null;
}

// 动态生成 Leaflet 彩色图标 (鲜绿色 🟢: 有绑定司机 / 亮红色 🔴: 没有绑定司机)
function createLorryIcon(hasDriver: boolean) {
  const bgColor = hasDriver ? '#22c55e' : '#ef4444'; // 鲜绿 (Green 500) / 亮红 (Red 500)
  const borderColor = hasDriver ? '#15803d' : '#b91c1c';
  const shadowColor = hasDriver ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)';
  const badgeEmoji = hasDriver ? '🚚' : '🅿️';

  return L.divIcon({
    className: 'custom-lorry-div-icon',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background-color: ${bgColor};
        border: 2px solid ${borderColor};
        border-radius: 50%;
        color: white;
        font-size: 20px;
        box-shadow: 0 4px 14px ${shadowColor};
        cursor: pointer;
        transition: transform 0.2s ease-in-out;
      ">
        <span>${badgeEmoji}</span>
        <span style="
          position: absolute;
          top: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          background-color: ${hasDriver ? '#16a34a' : '#dc2626'};
          border: 2px solid #ffffff;
          border-radius: 50%;
        "></span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
}

export default function LiveFleet() {
  const { t } = useTranslation();
  const [locations, setLocations] = useState<Record<string, DriverLocation>>({});
  const [loading, setLoading] = useState(true);

  // 默认中心点 (马来西亚全景视角)
  const defaultCenter: [number, number] = [3.1390, 101.6869];

  useEffect(() => {
    fetchInitialLocations();

    // 订阅 Supabase Realtime 位置更新
    const subscription = supabase
      .channel('driver_locations_changes')
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'driver_locations',
        },
        (payload) => {
          const newLoc = payload.new as DriverLocation;
          setLocations((prev) => ({
            ...prev,
            [newLoc.driver_id]: {
              ...prev[newLoc.driver_id],
              ...newLoc,
            },
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchInitialLocations = async () => {
    try {
      const locMap: Record<string, DriverLocation> = {};

      // 1. 读取 lorries 数据表，以公司的“罗里车队”作为核心主体实体
      const { data: lorriesData } = await supabase
        .from('lorries')
        .select('*');

      // 2. 读取 sys_users_v2 关联司机姓名
      const { data: usersData } = await supabase
        .from('sys_users_v2')
        .select('*')
        .eq('role', 'Driver');

      const userNameMap: Record<string, string> = {};
      if (usersData) {
        usersData.forEach(u => {
          const id = u.auth_user_id || u.id;
          if (id) {
            userNameMap[id] = u.name || u.email || '司机';
          }
        });
      }

      // 3. 读取 driver_locations 实时 GPS
      const { data: locData } = await supabase
        .from('driver_locations')
        .select('*')
        .order('updated_at', { ascending: false });

      const realtimeGpsMap: Record<string, any> = {};
      if (locData) {
        locData.forEach((loc) => {
          if (loc.driver_id && !realtimeGpsMap[loc.driver_id]) {
            realtimeGpsMap[loc.driver_id] = loc;
          }
        });
      }

      // 4. 读取正在执行配送的在途运单 (In-Transit, Loaded, Pending Approval)
      const { data: activeOrders } = await supabase
        .from('sales_orders')
        .select('*')
        .in('status', ['Loaded', 'In-Transit', 'Pending Approval', 'Delivered'])
        .not('driver_id', 'is', null)
        .order('updated_at', { ascending: false });

      const activeDriverOrders: Record<string, any> = {};
      if (activeOrders) {
        activeOrders.forEach(o => {
          if (o.driver_id && !activeDriverOrders[o.driver_id]) {
            activeDriverOrders[o.driver_id] = o;
          }
        });
      }

      // 5. 按【罗里/司机实体】精确唯一去重聚合
      if (lorriesData && lorriesData.length > 0) {
        lorriesData.forEach(lorry => {
          const driverId = lorry.driver_id;
          const lorryPlate = lorry.plate_number || lorry.lorry_number || '罗里';
          const hasDriver = Boolean(driverId && (userNameMap[driverId] || lorry.driver_name));
          
          if (driverId || lorry.id) {
            const key = driverId || lorry.id;
            const gps = driverId ? realtimeGpsMap[driverId] : null;
            const order = driverId ? activeDriverOrders[driverId] : null;
            const isDriving = Boolean((order && ['In-Transit', 'Loaded'].includes(order.status)) || (gps && gps.speed > 0));

            let lat = 0;
            let lng = 0;

            if (gps && gps.latitude && gps.longitude) {
              lat = Number(gps.latitude);
              lng = Number(gps.longitude);
            } else if (order && order.notes) {
              const match = order.notes.match(/Lat:\s*([0-9.-]+),\s*Lng:\s*([0-9.-]+)/i);
              if (match) {
                lat = parseFloat(match[1]);
                lng = parseFloat(match[2]);
              }
            }

            if (!lat && order) {
              const addr = `${order.delivery_address || ''} ${order.customer || ''} ${order.delivery_zone || ''}`;
              const cityCoords = getCityCoordinate(addr);
              if (cityCoords) {
                [lat, lng] = cityCoords;
              }
            }

            if (!lat) {
              [lat, lng] = [2.8167, 101.7972]; // Packsecure Main Factory Base
            }

            locMap[key] = {
              id: key,
              driver_id: key,
              latitude: lat,
              longitude: lng,
              speed: gps ? Number(gps.speed || 0) : 0,
              heading: 0,
              updated_at: (gps && gps.updated_at) || (order && order.updated_at) || new Date().toISOString(),
              driver_name: hasDriver ? (userNameMap[driverId] || lorry.driver_name) : undefined,
              vehicle_plate: lorryPlate,
              has_driver: hasDriver,
              is_active_driving: isDriving,
            };
          }
        });
      } else {
        // 若 lorries 表数据为空，按在途执勤司机去重
        Object.keys(activeDriverOrders).forEach(driverId => {
          const order = activeDriverOrders[driverId];
          const gps = realtimeGpsMap[driverId];
          const isDriving = Boolean(order && ['In-Transit', 'Loaded'].includes(order.status));

          let lat = 0;
          let lng = 0;
          if (gps && gps.latitude && gps.longitude) {
            lat = Number(gps.latitude);
            lng = Number(gps.longitude);
          } else if (order.notes) {
            const match = order.notes.match(/Lat:\s*([0-9.-]+),\s*Lng:\s*([0-9.-]+)/i);
            if (match) {
              lat = parseFloat(match[1]);
              lng = parseFloat(match[2]);
            }
          }

          if (!lat) {
            const addr = `${order.delivery_address || ''} ${order.customer || ''} ${order.delivery_zone || ''}`;
            const cityCoords = getCityCoordinate(addr);
            if (cityCoords) {
              [lat, lng] = cityCoords;
            }
          }

          if (!lat) [lat, lng] = [2.8167, 101.7972];

          locMap[driverId] = {
            id: driverId,
            driver_id: driverId,
            latitude: lat,
            longitude: lng,
            speed: gps ? Number(gps.speed || 0) : 0,
            heading: 0,
            updated_at: (gps && gps.updated_at) || order.updated_at || new Date().toISOString(),
            driver_name: order.driver_name || userNameMap[driverId] || '司机',
            vehicle_plate: (order as any).lorry_plate || '罗里车队',
            has_driver: true,
            is_active_driving: isDriving,
          };
        });
      }

      setLocations(locMap);
    } catch (err) {
      console.error('Error fetching driver locations:', err);
    } finally {
      setLoading(false);
    }
  };

  const rawDrivers = Object.values(locations).filter(driver => Boolean(driver.latitude && driver.longitude));
  
  // 核心微距防遮挡散开算法：如果多辆罗里在同一个经纬度/厂区，呈星芒圈自动在周围散开，确保 14 辆全暴露可见！
  const coordCounter: Record<string, number> = {};
  const activeDrivers = rawDrivers.map((driver) => {
    const key = `${driver.latitude.toFixed(3)}_${driver.longitude.toFixed(3)}`;
    const index = coordCounter[key] || 0;
    coordCounter[key] = index + 1;

    if (index > 0) {
      const angle = (index * 2 * Math.PI) / 6;
      const radius = 0.0035 * Math.ceil(index / 6); // 约 200 米环形阵列
      return {
        ...driver,
        latitude: driver.latitude + Math.sin(angle) * radius,
        longitude: driver.longitude + Math.cos(angle) * radius,
      };
    }

    return driver;
  });

  const assignedDriverCount = activeDrivers.filter(d => d.has_driver).length;
  const unassignedDriverCount = activeDrivers.length - assignedDriverCount;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className="p-5 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>🚚</span> Live Fleet 实时车队轨迹大屏
          </h1>
          <div className="flex items-center gap-4 text-sm mt-1.5">
            <span className="text-slate-300">
              全马罗里总数: <span className="font-bold text-white">{activeDrivers.length}</span> 辆
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
              <span>🟢 有绑定司机:</span> <span>{assignedDriverCount} 辆</span>
            </span>
            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
              <span>🔴 没有绑定司机:</span> <span>{unassignedDriverCount} 辆</span>
            </span>
          </div>
        </div>
        <button 
          onClick={fetchInitialLocations}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition shadow"
        >
          🔄 刷新实时车队
        </button>
      </div>

      <div className="flex-1 relative z-0">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
            <span className="text-slate-400 animate-pulse">正在加载全马罗里最新位置与绑定状态...</span>
          </div>
        ) : (
          <MapContainer 
            center={defaultCenter} 
            zoom={8} 
            style={{ height: '100%', width: '100%', zIndex: 0 }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {activeDrivers.map((driver) => (
              <Marker 
                key={driver.driver_id} 
                position={[driver.latitude, driver.longitude]}
                icon={createLorryIcon(driver.has_driver)}
              >
                <Popup>
                  <div className="p-1 min-w-[170px]">
                    {/* 🚛 罗里/货车车牌 + 绑定状态 Tag */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="bg-slate-900 text-white px-2.5 py-1 rounded font-black text-sm inline-block shadow">
                        🚛 {driver.vehicle_plate}
                      </div>
                      {driver.has_driver ? (
                        <span className="bg-emerald-500/20 text-emerald-700 border border-emerald-400/40 text-xs px-2 py-0.5 rounded font-bold">
                          🟢 已绑定司机
                        </span>
                      ) : (
                        <span className="bg-rose-500/20 text-rose-700 border border-rose-400/40 text-xs px-2 py-0.5 rounded font-bold">
                          🔴 没有绑定司机
                        </span>
                      )}
                    </div>

                    <div className="font-bold text-slate-800 text-sm mt-2.5 flex items-center gap-1">
                      <span>👤 司机: {driver.has_driver ? driver.driver_name : '未绑定司机'}</span>
                    </div>

                    <div className="text-slate-600 text-xs mt-1.5">
                      行驶速度: <span className="font-semibold text-emerald-600">{driver.speed.toFixed(1)} km/h</span>
                    </div>
                    <div className="text-slate-500 text-xs mt-1">
                      坐标: {driver.latitude.toFixed(4)}, {driver.longitude.toFixed(4)}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-1.5 border-t pt-1">
                      更新时间: {new Date(driver.updated_at).toLocaleTimeString()}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}

