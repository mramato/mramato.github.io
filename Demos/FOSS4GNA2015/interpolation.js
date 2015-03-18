(function() {
    /* globals Cesium */
    "use strict";

    //Create a Viewer instance with STK World terrain.
    var viewer = new Cesium.Viewer('cesiumContainer', {
        terrainProvider: new Cesium.CesiumTerrainProvider({
            url: '//cesiumjs.org/stk-terrain/world',
            requestWaterMask: true,
            requestVertexNormals: true
        }),
        baseLayerPicker: false
    });

    //Set the random number seed for consistent results.
    Cesium.Math.setRandomNumberSeed(3);

    //Set bounds of our simulation
    var start = Cesium.JulianDate.fromDate(new Date());
    var stop = Cesium.JulianDate.addSeconds(start, 360, new Cesium.JulianDate());

    //Make sure viewer is at the desired time.
    viewer.clock.startTime = start.clone();
    viewer.clock.stopTime = stop.clone();
    viewer.clock.currentTime = start.clone();
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    viewer.clock.multiplier = 5;
    viewer.timeline.zoomTo(start, stop);

    //Generate a random circular pattern.
    function computeCircle(lon, lat, radius) {
        var property = new Cesium.SampledPositionProperty();
        for (var i = 0; i <= 360; i += 45) {
            var radians = Cesium.Math.toRadians(i);
            var time = Cesium.JulianDate.addSeconds(start, i, new Cesium.JulianDate());
            var position = Cesium.Cartesian3.fromDegrees(lon + (radius * Math.cos(radians)), lat + (radius * Math.sin(radians)), Cesium.Math.nextRandomNumber() * 500 + 1750);
            property.addSample(time, position);

            //Also create a point for each sample we generate.
            viewer.entities.add({
                position: position,
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.HOT_PINK,
                    outlineColor: Cesium.Color.ORANGE,
                    outlineWidth: 2
                }
            });
        }
        return property;
    }

    //Compute the entity position property.
    var position = computeCircle(-112.110693, 36.0994841, 0.03);

    //Create an orientation property that is always oriented
    //along the direction of travel (this feature will be added to Cesium in a near-term release).
    var orientation = new Cesium.CallbackProperty(function(time, result) {
        var position1 = position.getValue(time);
        var position2 = position.getValue(Cesium.JulianDate.addSeconds(time, 1, new Cesium.JulianDate()));

        if (!Cesium.defined(position1) || !Cesium.defined(position2)) {
            return result;
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

        return Cesium.Quaternion.fromRotationMatrix(basis);
    }, false);

    //Actually create the entity with our computes positions and orientation
    var entity = viewer.entities.add({
        name: 'Tie Fighter',
        position: position,
        orientation: orientation,
        model: {
            uri: 'tie_fighter.gltf',
            minimumPixelSize: 32
        },
        path: {
            resolution: 1,
            material: Cesium.Color.HOTPINK,
            width: 5
        }
    });

    //Also set the availability of the entity to match our simulation time.
    entity.availability = new Cesium.TimeIntervalCollection();
    entity.availability.addInterval({
        start: start,
        stop: stop
    });

    //Wire up buttons
    var viewPathSide = document.getElementById('viewPathSide');
    viewPathSide.onclick = function() {
        viewer.trackedEntity = undefined;
        viewer.zoomTo(viewer.entities, new Cesium.HeadingPitchRange(Cesium.Math.toRadians(-90), Cesium.Math.toRadians(-15), 7500));
    };

    var viewPathTopDown = document.getElementById('viewPathTopDown');
    viewPathTopDown.onclick = function() {
        viewer.trackedEntity = undefined;
        viewer.zoomTo(viewer.entities, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-90)));
    };

    var viewTieFighter = document.getElementById('viewTieFighter');
    viewTieFighter.onclick = function() {
        viewer.trackedEntity = entity;
    };

    var linear = document.getElementById('linear');
    linear.onclick = function() {
        entity.position.setInterpolationOptions({
            interpolationDegree: 1,
            interpolationAlgorithm: Cesium.LinearApproximation
        });
    };

    var lagrange = document.getElementById('lagrange');
    lagrange.onclick = function() {
        entity.position.setInterpolationOptions({
            interpolationDegree: 5,
            interpolationAlgorithm: Cesium.LagrangePolynomialApproximation
        });
    };

    var hermite = document.getElementById('hermite');
    hermite.onclick = function() {
        entity.position.setInterpolationOptions({
            interpolationDegree: 2,
            interpolationAlgorithm: Cesium.HermitePolynomialApproximation
        });
    };

    //Initial view
    viewPathSide.onclick();
}());