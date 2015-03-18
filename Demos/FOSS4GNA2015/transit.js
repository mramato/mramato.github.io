(function() {
    /* globals Cesium */
    "use strict";

    //This code is quick and dirty and shouldn't really be used for learning (yet).
    //See Cesium Sandcastle for examples to learn from: http://cesiumjs.org/Cesium/Apps/Sandcastle/index.html

    function queryNumericAttribute(node, attributeName) {
        if (!Cesium.defined(node)) {
            return undefined;
        }

        var value = node.getAttribute(attributeName);
        if (value !== null) {
            var result = parseFloat(value);
            return !isNaN(result) ? result : undefined;
        }
        return undefined;
    }

    function queryStringAttribute(node, attributeName) {
        if (!Cesium.defined(node)) {
            return undefined;
        }
        var value = node.getAttribute(attributeName);
        return value !== null ? value : undefined;
    }

    function describe(properties) {
        var html = '';
        for (var key in properties) {
            if (properties.hasOwnProperty(key)) {
                var value = properties[key];
                if (Cesium.defined(value)) {
                    html += '<tr><th>' + key + '</th><td>' + value + '</td></tr>';
                }
            }
        }

        if (html.length > 0) {
            html = '<table class="cesium-infoBox-defaultTable"><tbody>' + html + '</tbody></table>';
        }

        return html;
    }

    function createDescriptionCallback(entity) {
        var description;
        return function(time, result) {
            return describe(entity.properties);
        };
    }

    function createOrientation(position) {
        return new Cesium.CallbackProperty(function(time, result) {
            var position1 = position.getValue(time);
            var position2 = position.getValue(Cesium.JulianDate.addSeconds(time, 1, new Cesium.JulianDate()));
            if (!Cesium.defined(position1) || !Cesium.defined(position2) || Cesium.Cartesian3.equals(position1, position2)) {
                return undefined;
            }
            var normal = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(position1);

            var direction = Cesium.Cartesian3.subtract(position2, position1, new Cesium.Cartesian3());
            Cesium.Cartesian3.normalize(direction, direction);
            var right = Cesium.Cartesian3.cross(direction, normal, new Cesium.Cartesian3());
            var up = Cesium.Cartesian3.cross(right, direction, new Cesium.Cartesian3());
            Cesium.Cartesian3.cross(direction, up, right);

            var basis = new Cesium.Matrix3();
            Cesium.Matrix3.setColumn(basis, 1, Cesium.Cartesian3.negate(right, right), basis);
            Cesium.Matrix3.setColumn(basis, 0, direction, basis);
            Cesium.Matrix3.setColumn(basis, 2, up, basis);

            return Cesium.Quaternion.fromRotationMatrix(basis, result);
        }, false);
    }

    function processUrl(url) {
        viewer.entities.suspendEvents();
        var milliseconds = Cesium.getFilenameFromUri(url);
        milliseconds = parseFloat(milliseconds.substring(0, milliseconds.length - 4));
        var time = Cesium.JulianDate.fromDate(new Date(milliseconds * 1000));

        return Cesium.when(Cesium.loadXML(url), function(xml) {
            var body = xml.documentElement;
            var childNodes = body.childNodes;
            var length = childNodes.length;
            for (var q = 0; q < length; q++) {
                var child = childNodes[q];
                if (child.localName === 'vehicle') {
                    var id = queryStringAttribute(child, 'id');
                    var routeTag = queryStringAttribute(child, 'routeTag');
                    var dirTag = queryStringAttribute(child, 'dirTag');
                    var lat = queryNumericAttribute(child, 'lat');
                    var lon = queryNumericAttribute(child, 'lon');
                    var secSinceReport = queryNumericAttribute(child, 'secsSinceReport');
                    var predictable = queryStringAttribute(child, 'predictable');
                    var heading = queryNumericAttribute(child, 'heading');
                    var speedKmHr = queryNumericAttribute(child, 'speedKmHr');
                    var leadingVehicleId = queryNumericAttribute(child, 'leadingVehicleId');

                    var entity = viewer.entities.getOrCreateEntity(id + ' ' + routeTag + ' ' + dirTag);
                    if (!Cesium.defined(entity.position)) {
                        entity.position = new Cesium.SampledPositionProperty();
                        entity.position.backwardExtrapolationType = Cesium.ExtrapolationType.NONE;
                        entity.position.forwardExtrapolationType = Cesium.ExtrapolationType.NONE;

                        entity.orientation = createOrientation(entity.position);

                        entity.model = {
                            uri: 'CesiumMilkTruck.gltf',
                            minimumPixelSize: 24
                        };

                        entity.properties = {};
                    }

                    entity.properties.id = id;
                    entity.properties.routeTag = routeTag;
                    entity.properties.dirTag = dirTag;
                    entity.properties.lat = lat;
                    entity.properties.lon = lon;
                    entity.properties.secSinceReport = secSinceReport;
                    entity.properties.predictable = predictable;
                    entity.properties.heading = heading;
                    entity.properties.speedKmHr = speedKmHr;
                    entity.properties.leadingVehicleId = leadingVehicleId;

                    var samplePosition = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
                    var sampleTime = Cesium.JulianDate.addSeconds(time, -secSinceReport, new Cesium.JulianDate());
                    entity.position.addSample(sampleTime, samplePosition);
                    entity.description = new Cesium.CallbackProperty(createDescriptionCallback(entity), true);
                }
            }
            viewer.entities.resumeEvents();
        });
    }

    var viewer = new Cesium.Viewer('cesiumContainer');

    var start = 1411704001;
    var stop = 1411707541;

    viewer.clock.startTime = Cesium.JulianDate.fromDate(new Date(start * 1000));
    viewer.clock.stopTime = Cesium.JulianDate.fromDate(new Date(stop * 1000));
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date(start * 1000));
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    viewer.clock.multiplier = 15;
    viewer.timeline.zoomTo(viewer.clock.startTime, viewer.clock.stopTime);

    //The full data set is a week, but we only process an hour
    //here.  Cesium can handle the entire week just fine, but
    //the native XML format is really innefficient for loading.
    //Data is from: https://github.com/bdon/transit-datathon
    var path = 'sf-muni/';
    var promise = processUrl(path + start + '.xml');
    for (var i = start + 60; i < stop; i += 60) {
        promise = promise.then(processUrl(path + i + '.xml'));
    }

    //Use the geocoder to fly to San Fancisco.
    viewer.geocoder.viewModel.searchText = "San Francisco, CA";
    viewer.geocoder.viewModel.search();
}());