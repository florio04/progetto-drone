function groupDataByPrecision(features, precisionLevel) {
    const groups = {};

    features.forEach(f => {
        const props = f.properties;
        const clusterHash = props.geohash ? props.geohash.substring(0, precisionLevel) : f.geometry.coordinates.join(',');

        if (!groups[clusterHash]) {
            groups[clusterHash] = {
                xSum: 0,         
                ySum: 0,         
                zSum: 0,         
                allFeatures: [], 
                photos: [],
                count: 0
            };
        }

        const lon = f.geometry.coordinates[0];
        const lat = f.geometry.coordinates[1];

        const latRad = lat * Math.PI / 180;
        const lonRad = lon * Math.PI / 180;

        groups[clusterHash].xSum += Math.cos(latRad) * Math.cos(lonRad);
        groups[clusterHash].ySum += Math.cos(latRad) * Math.sin(lonRad);
        groups[clusterHash].zSum += Math.sin(latRad);
        
        groups[clusterHash].allFeatures.push(f);
        groups[clusterHash].count++;
        
        if (props.zona_foto_url) {
            groups[clusterHash].photos.push(props.zona_foto_url);
        }
    });

    return Object.values(groups).map(cluster => {
        const x = cluster.xSum / cluster.count;
        const y = cluster.ySum / cluster.count;
        const z = cluster.zSum / cluster.count;

        const lonRad = Math.atan2(y, x);
        const hypotenuse = Math.sqrt(x * x + y * y);
        const latRad = Math.atan2(z, hypotenuse);

        cluster.lat = latRad * 180 / Math.PI;
        cluster.lon = lonRad * 180 / Math.PI;
        
        return cluster;
    });
}