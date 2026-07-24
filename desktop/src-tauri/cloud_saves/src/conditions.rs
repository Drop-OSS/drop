use database::platform::Platform;

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum Condition {
    Os(Platform),
    Other,
}
