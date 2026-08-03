use serde_json::{Map, Value};

pub fn is_brigx_session(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    string(object, "version").is_some_and(|value| !value.is_empty())
        && number(object, "timestamp")
        && string(object, "referenceFileName").is_some()
        && optional_array(object, "referenceAnnotations", is_annotation)
        && array(object, "rings", is_session_ring)
        && object.get("params").is_some_and(is_pipeline_params)
        && object.get("imageConfig").is_some_and(is_image_config)
}

pub fn is_circular_plot_data(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    let Some(reference) = object.get("reference").and_then(Value::as_object) else {
        return false;
    };
    let Some(config) = object.get("config").and_then(Value::as_object) else {
        return false;
    };

    string(reference, "name").is_some()
        && non_negative_integer(reference, "length")
        && optional_array(reference, "gcContent", is_number)
        && optional_array(reference, "gcSkew", is_number)
        && optional_array(reference, "features", is_feature)
        && optional_array(reference, "annotations", is_annotation)
        && optional_array(reference, "contigs", is_contig)
        && array(object, "rings", is_plot_ring)
        && number(config, "minIdentity")
        && number(config, "minAlignmentLength")
}

fn is_session_ring(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    string(object, "id").is_some()
        && string(object, "legendText").is_some()
        && string(object, "color").is_some()
        && number(object, "upperThreshold")
        && number(object, "lowerThreshold")
        && optional_number(object, "customWidth")
        && optional_number(object, "graphMaxCap")
        && optional_boolean(object, "showLabels")
        && optional_one_of(object, "blastType", &["blastn", "blastx"])
        && array(object, "fileNames", Value::is_string)
        && array(object, "annotations", is_annotation)
}

fn is_pipeline_params(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    number(object, "minIdentity")
        && number(object, "minAlignmentLength")
        && string(object, "colorScheme").is_some()
        && boolean(object, "forceAlignment")
        && optional_string(object, "alignerOptions")
        && optional_number(object, "spacerSize")
        && optional_one_of(object, "blastProgram", &["blastn", "blastx"])
        && optional_boolean(object, "showGCContent")
        && optional_boolean(object, "showGCSkew")
}

fn is_image_config(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    const NUMBER_FIELDS: &[&str] = &[
        "innerRadius",
        "ringWidth",
        "gcRingWidth",
        "ringSpacing",
        "legendFontSize",
        "scaleFontSize",
        "titleFontSize",
        "labelFontSize",
    ];
    string(object, "title").is_some()
        && NUMBER_FIELDS.iter().all(|field| number(object, field))
        && optional_boolean(object, "showLegend")
}

fn is_plot_ring(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    let Some(statistics) = object.get("statistics").and_then(Value::as_object) else {
        return false;
    };
    let graph_stats_valid = object.get("graphStats").is_none_or(|value| {
        value.as_object().is_some_and(|stats| {
            number(stats, "mean") && number(stats, "q3") && number(stats, "max")
        })
    });

    string(object, "queryId").is_some()
        && string(object, "queryName").is_some()
        && string(object, "color").is_some()
        && boolean(object, "visible")
        && array(object, "hits", is_alignment_hit)
        && optional_array(object, "annotations", is_annotation)
        && optional_array(object, "graphPoints", is_graph_point)
        && optional_number(object, "customWidth")
        && optional_number(object, "graphMaxValue")
        && optional_number(object, "graphMaxCap")
        && optional_number(object, "upperThreshold")
        && optional_number(object, "lowerThreshold")
        && optional_string(object, "alignmentOutput")
        && optional_boolean(object, "showLabels")
        && graph_stats_valid
        && number(statistics, "meanIdentity")
        && number(statistics, "genomeCoverage")
        && number(statistics, "totalAlignedBases")
}

fn is_alignment_hit(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    string(object, "queryName").is_some()
        && number(object, "refStart")
        && number(object, "refEnd")
        && number(object, "queryStart")
        && number(object, "queryEnd")
        && number(object, "percentIdentity")
        && number(object, "alignmentLength")
        && one_of(object, "strand", &["+", "-"])
        && optional_number(object, "score")
}

fn is_annotation(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    string(object, "id").is_some()
        && number(object, "start")
        && number(object, "end")
        && string(object, "label").is_some()
        && one_of(
            object,
            "shape",
            &["arrow-forward", "arrow-reverse", "block", "arc", "hidden"],
        )
        && optional_string(object, "color")
}

fn is_feature(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    let attributes_valid = object.get("attributes").is_none_or(|value| {
        value
            .as_object()
            .is_some_and(|attributes| attributes.values().all(Value::is_string))
    });
    string(object, "type").is_some()
        && number(object, "start")
        && number(object, "end")
        && one_of(object, "strand", &["+", "-"])
        && optional_string(object, "name")
        && optional_string(object, "product")
        && optional_string(object, "color")
        && attributes_valid
}

fn is_contig(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    string(object, "name").is_some()
        && non_negative_integer(object, "start")
        && non_negative_integer(object, "end")
        && non_negative_integer(object, "index")
}

fn is_graph_point(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    number(object, "start") && number(object, "end") && number(object, "value")
}

fn is_number(value: &Value) -> bool {
    value.is_number()
}

fn string<'a>(object: &'a Map<String, Value>, key: &str) -> Option<&'a str> {
    object.get(key).and_then(Value::as_str)
}

fn number(object: &Map<String, Value>, key: &str) -> bool {
    object.get(key).is_some_and(Value::is_number)
}

fn boolean(object: &Map<String, Value>, key: &str) -> bool {
    object.get(key).is_some_and(Value::is_boolean)
}

fn non_negative_integer(object: &Map<String, Value>, key: &str) -> bool {
    object.get(key).and_then(Value::as_u64).is_some()
}

fn array(object: &Map<String, Value>, key: &str, predicate: fn(&Value) -> bool) -> bool {
    object
        .get(key)
        .and_then(Value::as_array)
        .is_some_and(|items| items.iter().all(predicate))
}

fn optional_array(object: &Map<String, Value>, key: &str, predicate: fn(&Value) -> bool) -> bool {
    object.get(key).is_none_or(|value| {
        value
            .as_array()
            .is_some_and(|items| items.iter().all(predicate))
    })
}

fn optional_number(object: &Map<String, Value>, key: &str) -> bool {
    object.get(key).is_none_or(Value::is_number)
}

fn optional_string(object: &Map<String, Value>, key: &str) -> bool {
    object.get(key).is_none_or(Value::is_string)
}

fn optional_boolean(object: &Map<String, Value>, key: &str) -> bool {
    object.get(key).is_none_or(Value::is_boolean)
}

fn one_of(object: &Map<String, Value>, key: &str, allowed: &[&str]) -> bool {
    string(object, key).is_some_and(|value| allowed.contains(&value))
}

fn optional_one_of(object: &Map<String, Value>, key: &str, allowed: &[&str]) -> bool {
    object.get(key).is_none_or(|_| one_of(object, key, allowed))
}

#[cfg(test)]
mod tests {
    use super::{is_brigx_session, is_circular_plot_data};
    use serde_json::json;

    #[test]
    fn validates_minimal_session_and_plot() {
        let session = json!({
            "version": "test",
            "timestamp": 0,
            "referenceFileName": "reference.fa",
            "referenceAnnotations": [],
            "rings": [],
            "params": {
                "minIdentity": 70,
                "minAlignmentLength": 1000,
                "colorScheme": "blue-red",
                "forceAlignment": false
            },
            "imageConfig": {
                "innerRadius": 200,
                "ringWidth": 20,
                "gcRingWidth": 40,
                "ringSpacing": 4,
                "legendFontSize": 16,
                "scaleFontSize": 12,
                "titleFontSize": 24,
                "labelFontSize": 14,
                "title": ""
            }
        });
        let plot = json!({
            "reference": { "name": "reference", "length": 8 },
            "rings": [],
            "config": { "minIdentity": 70, "minAlignmentLength": 1000 }
        });
        assert!(is_brigx_session(&session));
        assert!(is_circular_plot_data(&plot));
        assert!(!is_brigx_session(&json!({})));
        assert!(!is_circular_plot_data(&json!({})));
    }
}
