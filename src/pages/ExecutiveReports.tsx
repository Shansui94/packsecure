import React from 'react';
import ProductionReports from './ProductionReports';

interface ExecutiveReportsProps {
    user: any;
}

/**
 * ExecutiveReports — 高管决策与经营综合看板 (Executive Suite)
 * 统一承载高管经营总览、多月产销趋势环比、四大基地对比与物流履约分析
 */
const ExecutiveReports: React.FC<ExecutiveReportsProps> = ({ user }) => {
    return <ProductionReports user={user} initialTab="overview" />;
};

export default ExecutiveReports;
